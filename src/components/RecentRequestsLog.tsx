import React from "react";
import { useLogContext } from "@/context/LogContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock } from "lucide-react";

const RecentRequestsLog = () => {
  const { logs } = useLogContext();

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusBadge = (status: "Success" | "Error") => {
    if (status === "Success") {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300">
          <CheckCircle className="h-3 w-3 mr-1" /> Success
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-300">
        <XCircle className="h-3 w-3 mr-1" /> Error
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center">
          <Clock className="h-5 w-5 mr-2 text-muted-foreground" /> Recent Requests Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Time</TableHead>
                <TableHead className="w-[120px]">Device ID</TableHead>
                <TableHead className="w-[100px]">Command</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No requests logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-xs">
                      {formatTime(log.timestamp)}
                    </TableCell>
                    <TableCell className="text-sm">{log.deviceId}</TableCell>
                    <TableCell className="text-sm font-medium">{log.command}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.message}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentRequestsLog;