import { DeviceConfig, DeviceId } from "@/types/api";

// Początkowe dane konfiguracyjne, zgodne z devices.json
const initialConfigs: Record<DeviceId, DeviceConfig> = {
  "C320": {
    "name": "C320 Rinstrum",
    "manufacturer": "Rinstrum",
    "model": "C320",
    "protocol": "RINCMD",
    "connection": {
      "connection_type": "Tcp",
      "host": "192.168.1.254",
      "port": 4001,
      "timeout_ms": 3000
    },
    "commands": {
      "readGross": "20050026",
      "readNet": "20050025",
      "tare": "21120008:0C",
      "zero": "21120008:0B"
    },
    "enabled": true
  },
  "DWF": {
    "name": "DFW - Dini Argeo",
    "manufacturer": "Dini Argeo",
    "model": "DFW",
    "protocol": "DINI_ARGEO",
    "connection": {
      "connection_type": "Serial",
      "port": "/dev/ttyUSB0",
      "baud_rate": 9600,
      "timeout_ms": 1000
    },
    "commands": {
      "readGross": "READ",
      "readNet": "REXT",
      "tare": "TARE",
      "zero": "ZERO"
    },
    "enabled": false
  }
};

let deviceConfigs: Record<DeviceId, DeviceConfig> = { ...initialConfigs };

export const mockDb = {
  getConfigs: (): Record<DeviceId, DeviceConfig> => {
    return deviceConfigs;
  },

  saveConfig: (deviceId: DeviceId, config: DeviceConfig): void => {
    deviceConfigs = {
      ...deviceConfigs,
      [deviceId]: config,
    };
    console.log(`[MockDB] Configuration saved for ${deviceId}. Current devices:`, Object.keys(deviceConfigs));
  },

  deleteConfig: (deviceId: DeviceId): void => {
    const { [deviceId]: _, ...rest } = deviceConfigs;
    deviceConfigs = rest;
    console.log(`[MockDB] Configuration deleted for ${deviceId}. Current devices:`, Object.keys(deviceConfigs));
  },
};