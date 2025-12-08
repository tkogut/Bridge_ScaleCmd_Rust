scale-connection-manager

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import * as net from 'net';
import type { WebContents } from 'electron';
import { parseRinCmdResponse, parseGenericResponse } from './scale-parser.ts';
import type { ReadMode } from './types.ts'; // Importujemy ReadMode

// Minimalne typy dla konfiguracji (używamy 'any' dla pełnej konfiguracji urządzenia, jak w electron-main.ts)
interface DeviceConfigStub {
    protocol: string;
    commands: {
        readGross: string;
        readNet: string;
        tare: string;
        zero: string;
    };
    shortcut?: string;
}

interface ConnectionConfigStub {
    connection_type: 'Serial' | 'Tcp';
    port?: string;
    baud_rate?: number;
    host?: string;
    timeout_ms: number;
}

// Minimalny typ dla SerialPortInfo
interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  pnpId?: string;
}


export class ScaleConnectionManager {
    private webContents: WebContents;
    private currentConnection: SerialPort | net.Socket | null = null;
    private currentDeviceConfig: any | null = null;
    private currentConnectionConfig: any | null = null;
    private dataInterval: NodeJS.Timeout | null = null;
    private currentReadMode: ReadMode = "Gross";
    private isContinuousReading = true;
    private rawCommandResolver: ((response: string) => void) | null = null;
    private rawCommandTimeout: NodeJS.Timeout | null = null;
    private tcpDataBuffer = "";

    constructor(webContents: WebContents) {
        this.webContents = webContents;
    }

    private sendStatus(isConnected: boolean, message: string): void {
        this.webContents.send('scale-status-change', { isConnected, message });
    }

    private sendData(data: { weight: string, status: string }): void {
        this.webContents.send('scale-data', data);
    }

    private getCommandTerminator(protocol: string): string {
        if (protocol === 'DINI_ARGEO' || protocol === 'RINCMD') {
            return '\r\n';
        }
        return '';
    }

    private processRawData(rawData: string): void {
        console.log(`Data Processed: ${rawData}`);
        
        if (this.rawCommandResolver) {
            if (this.rawCommandTimeout) clearTimeout(this.rawCommandTimeout);
            this.rawCommandResolver(rawData);
            this.rawCommandResolver = null;
            setTimeout(() => this.startPolling(), 100);
            return;
        }

        let parsed = null;
        if (!this.currentDeviceConfig) return;

        if (this.currentDeviceConfig.protocol === 'RINCMD') {
            parsed = parseRinCmdResponse(rawData);
        } else {
            parsed = parseGenericResponse(rawData);
        }
        
        if (parsed) {
            this.sendData(parsed);
        }
    }

    private handleTcpIncomingData(data: Buffer): void {
        this.tcpDataBuffer += data.toString();
        
        const lines = this.tcpDataBuffer.split('\n');
        this.tcpDataBuffer = lines.pop() || ""; 
        
        lines.forEach(line => {
            const rawData = line.trim();
            if (rawData) {
                this.processRawData(rawData);
            }
        });
    }

    public startPolling(): void {
        if (this.dataInterval) {
            clearInterval(this.dataInterval);
        }
        
        if (!this.isContinuousReading || !this.currentConnection || !this.currentDeviceConfig) {
            return;
        }
        
        const deviceConfig = this.currentDeviceConfig;
        const terminator = this.getCommandTerminator(deviceConfig.protocol);
        
        this.dataInterval = setInterval(() => {
            if (this.currentConnection && this.currentDeviceConfig && !this.rawCommandResolver) {
                const commandKey = this.currentReadMode === "Gross" ? "readGross" : "readNet";
                const command = this.currentDeviceConfig.commands[commandKey];
                
                if (!command) {
                    console.warn(`Brak komendy dla trybu ${this.currentReadMode} w konfiguracji.`);
                    return;
                }
                
                const dataToSend = `${command}${terminator}`;
                
                if (this.currentConnection instanceof SerialPort) {
                    this.currentConnection.write(dataToSend, (err) => {
                        if (err) console.error(`Błąd zapisu SerialPort podczas odpytywania: ${err.message}`);
                    });
                } else if (this.currentConnection instanceof net.Socket) {
                    this.currentConnection.write(dataToSend, (err) => {
                        if (err) console.error(`Błąd zapisu TCP podczas odpytywania: ${err.message}`);
                    });
                }
            }
        }, 500);
    }

    public closeConnection(): void {
        if (this.dataInterval) {
            clearInterval(this.dataInterval);
            this.dataInterval = null;
        }
        if (this.currentConnection) {
            if ('close' in this.currentConnection && typeof this.currentConnection.close === 'function') {
                this.currentConnection.close();
            } else if ('destroy' in this.currentConnection && typeof this.currentConnection.destroy === 'function') {
                this.currentConnection.destroy();
            }
            this.currentConnection = null;
            this.currentDeviceConfig = null;
            this.currentConnectionConfig = null;
            this.tcpDataBuffer = "";
            this.sendStatus(false, "Rozłączono");
        }
    }

    public async connect(deviceConfig: any, connectionConfig: any, initialReadMode: ReadMode): Promise<void> {
        this.closeConnection();
        this.currentDeviceConfig = deviceConfig;
        this.currentConnectionConfig = connectionConfig;
        this.currentReadMode = initialReadMode;
        
        const connectionType = connectionConfig.connection_type;
        
        return new Promise<void>((resolve, reject) => {
            if (connectionType === 'Serial') {
                const serialConfig = connectionConfig;
                
                const port = new SerialPort({ 
                    path: serialConfig.port, 
                    baudRate: serialConfig.baud_rate,
                    dataBits: 8,
                    stopBits: 1,
                    parity: 'none',
                });
                
                const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
                this.currentConnection = port;

                port.on('open', () => {
                    this.sendStatus(true, `Połączono przez Serial z ${serialConfig.port}`);
                    if (this.isContinuousReading) {
                        this.startPolling();
                    }
                    resolve();
                });

                parser.on('data', (data: string) => this.processRawData(data));

                port.on('error', (err) => {
                    this.closeConnection();
                    this.sendStatus(false, `Błąd SerialPort: ${err.message}`);
                    reject(new Error(`Błąd SerialPort: ${err.message}`));
                });
                
                port.on('close', () => {
                    this.closeConnection();
                    this.sendStatus(false, `Połączenie SerialPort zamknięte.`);
                });

            } else if (connectionType === 'Tcp') {
                const tcpConfig = connectionConfig;
                
                const client = net.connect({ host: tcpConfig.host, port: tcpConfig.port });
                this.currentConnection = client;

                client.on('connect', () => {
                    this.sendStatus(true, `Połączono przez TCP z ${tcpConfig.host}:${tcpConfig.port}`);
                    if (this.isContinuousReading) {
                        this.startPolling();
                    }
                    resolve();
                });

                client.on('data', (data) => this.handleTcpIncomingData(data));

                client.on('error', (err) => {
                    this.closeConnection();
                    this.sendStatus(false, `Błąd TCP: ${err.message}`);
                    reject(new Error(`Błąd TCP: ${err.message}`));
                });
                
                client.on('close', () => {
                    this.closeConnection();
                    this.sendStatus(false, `Połączenie TCP zamknięte.`);
                });
                
                client.setTimeout(tcpConfig.timeout_ms, () => {
                    if (client.connecting) {
                        this.closeConnection();
                        this.sendStatus(false, `Timeout połączenia TCP.`);
                        reject(new Error(`Timeout połączenia TCP.`));
                    }
                });
            } else {
                reject(new Error("Nieznany typ połączenia."));
            }
        });
    }

    public async sendCommand(commandType: 'tare' | 'zero'): Promise<void> {
        if (!this.currentConnection || !this.currentDeviceConfig) {
            throw new Error("Brak aktywnego połączenia.");
        }
        
        const command = this.currentDeviceConfig.commands[commandType];
        const terminator = this.getCommandTerminator(this.currentDeviceConfig.protocol);
        const dataToSend = `${command}${terminator}`;
        
        return new Promise((resolve, reject) => {
            const writeCallback = (err: Error | null | undefined) => {
                if (err) {
                    reject(new Error(`Błąd zapisu: ${err.message}`));
                } else {
                    if (commandType === 'tare') {
                        this.currentReadMode = 'Net';
                    }
                    resolve();
                }
            };

            if (this.currentConnection instanceof SerialPort) {
                this.currentConnection.write(dataToSend, writeCallback);
            } else if (this.currentConnection instanceof net.Socket) {
                this.currentConnection.write(dataToSend, writeCallback);
            } else {
                reject(new Error("Nieobsługiwany typ połączenia."));
            }
        });
    }

    public async sendRawCommand(command: string): Promise<string> {
        if (!this.currentConnection || !this.currentDeviceConfig) {
            throw new Error("Brak aktywnego połączenia.");
        }
        
        if (this.dataInterval) {
            clearInterval(this.dataInterval);
            this.dataInterval = null;
        }
        
        return new Promise<string>((resolve, reject) => {
            this.rawCommandResolver = resolve;
            
            this.rawCommandTimeout = setTimeout(() => {
                this.rawCommandResolver = null;
                reject(new Error("Timeout: Nie otrzymano odpowiedzi na surową komendę."));
                if (this.isContinuousReading) {
                    this.startPolling();
                }
            }, 10000);
            
            const terminator = this.getCommandTerminator(this.currentDeviceConfig.protocol);
            const dataToSend = `${command}${terminator}`;
            
            const writeCallback = (err: Error | null | undefined) => {
                if (err) {
                    if (this.rawCommandTimeout) clearTimeout(this.rawCommandTimeout);
                    this.rawCommandResolver = null;
                    reject(new Error(`Błąd zapisu: ${err.message}`));
                    if (this.isContinuousReading) this.startPolling();
                }
            };

            if (this.currentConnection instanceof SerialPort) {
                this.currentConnection.write(dataToSend, writeCallback);
            } else if (this.currentConnection instanceof net.Socket) {
                this.currentConnection.write(dataToSend, writeCallback);
            } else {
                if (this.rawCommandTimeout) clearTimeout(this.rawCommandTimeout);
                this.rawCommandResolver = null;
                reject(new Error("Nieobsługiwany typ połączenia."));
                if (this.isContinuousReading) this.startPolling();
            }
        });
    }

    public async readOnce(): Promise<void> {
        if (!this.currentConnection || !this.currentDeviceConfig) {
            throw new Error("Brak aktywnego połączenia.");
        }
        
        const commandKey = this.currentReadMode === "Gross" ? "readGross" : "readNet";
        const command = this.currentDeviceConfig.commands[commandKey];
        
        if (!command) {
            throw new Error(`Brak komendy dla trybu ${this.currentReadMode} w konfiguracji.`);
        }
        
        const terminator = this.getCommandTerminator(this.currentDeviceConfig.protocol);
        const dataToSend = `${command}${terminator}`;
        
        return new Promise<void>((resolve, reject) => {
            const writeCallback = (err: Error | null | undefined) => {
                if (err) {
                    reject(new Error(`Błąd zapisu podczas jednorazowego odczytu: ${err.message}`));
                } else {
                    resolve();
                }
            };
            
            if (this.currentConnection instanceof SerialPort) {
                this.currentConnection.write(dataToSend, writeCallback);
            } else if (this.currentConnection instanceof net.Socket) {
                this.currentConnection.write(dataToSend, writeCallback);
            } else {
                reject(new Error("Nieobsługiwany typ połączenia."));
            }
        });
    }

    public setReadMode(mode: ReadMode): void {
        this.currentReadMode = mode;
        if (this.currentConnection && this.currentDeviceConfig && this.isContinuousReading) {
            this.startPolling();
        }
    }

    public setContinuousReading(isContinuous: boolean): void {
        this.isContinuousReading = isContinuous;
        if (isContinuous) {
            if (this.currentConnection && this.currentDeviceConfig) {
                this.startPolling();
            }
        } else {
            if (this.dataInterval) {
                clearInterval(this.dataInterval);
                this.dataInterval = null;
            }
        }
    }
    
    public async listSerialPorts(): Promise<SerialPortInfo[]> {
        try {
            const ports = await SerialPort.list();
            return ports.map(p => ({
                path: p.path,
                manufacturer: p.manufacturer,
                pnpId: p.pnpId,
            }));
        } catch (error) {
            console.error("Błąd listowania portów szeregowych:", error);
            return [];
        }
    }
}