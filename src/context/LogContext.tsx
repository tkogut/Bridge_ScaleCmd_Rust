import React, { createContext, useContext, useState, useCallback } from "react";
import { LogEntry, DeviceId, Command, ScaleCommandResponse } from "@/types/api";

interface LogContextType {
  logs: LogEntry[];
  addLog: (
    deviceId: DeviceId,
    command: Command,
    response: ScaleCommandResponse,
    error?: Error,
  ) => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const useLogContext = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error("useLogContext must be used within a LogProvider");
  }
  return context;
};

const MAX_LOGS = 10;

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback(
    (
      deviceId: DeviceId,
      command: Command,
      response: ScaleCommandResponse,
      error?: Error,
    ) => {
      const timestamp = new Date().toISOString();
      let status: LogEntry["status"];
      let message: string;

      if (error) {
        status = "Error";
        message = `API Error: ${error.message}`;
      } else if (response.success) {
        status = "Success";
        if (response.result && "gross_weight" in response.result) {
          const reading = response.result;
          message = `Read ${reading.gross_weight.toFixed(2)} ${reading.unit} (Stable: ${reading.is_stable})`;
        } else if (response.result && "message" in response.result) {
          message = response.result.message;
        } else {
          message = "Command executed successfully.";
        }
      } else {
        status = "Error";
        message = response.error || "Command failed.";
      }

      const newLog: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp,
        deviceId,
        command,
        status,
        message,
      };

      setLogs((prevLogs) => [newLog, ...prevLogs].slice(0, MAX_LOGS));
    },
    [],
  );

  return (
    <LogContext.Provider value={{ logs, addLog }}>
      {children}
    </LogContext.Provider>
  );
};