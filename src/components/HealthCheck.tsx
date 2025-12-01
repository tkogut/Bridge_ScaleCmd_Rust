import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const HealthCheck = () => {
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  
  const checkHealth = async () => {
    setStatus("checking");
    setMessage("Checking connection...");
    
    try {
      // Try to connect to a health endpoint
      const response = await fetch("/api/health");
      
      if (response.ok) {
        const data = await response.json();
        setStatus("success");
        setMessage(`Connected successfully. Backend says: ${data.message || "OK"}`);
      } else {
        setStatus("error");
        setMessage(`Backend returned error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setStatus("error");
      setMessage(`Connection failed: ${error.message}`);
    }
  };
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Backend Health Check</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Status:</span>
          <span className={`px-2 py-1 rounded ${
            status === "success" 
              ? "bg-green-100 text-green-800" 
              : status === "error"
              ? "bg-red-100 text-red-800"
              : status === "checking"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-gray-100 text-gray-800"
          }`}>
            {status === "idle" && "Not checked"}
            {status === "checking" && "Checking..."}
            {status === "success" && "Connected"}
            {status === "error" && "Error"}
          </span>
        </div>
        
        {message && (
          <div className={`p-3 rounded ${
            status === "success" 
              ? "bg-green-50 text-green-800" 
              : status === "error"
              ? "bg-red-50 text-red-800"
              : "bg-gray-50 text-gray-800"
          }`}>
            {message}
          </div>
        )}
        
        <Button 
          onClick={checkHealth} 
          disabled={status === "checking"}
          className="w-full"
        >
          {status === "checking" ? "Checking..." : "Check Connection"}
        </Button>
        
        <div className="text-sm text-gray-500 mt-4">
          <p className="font-medium">Troubleshooting tips:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Ensure your backend server is running</li>
            <li>Check if API endpoints are correctly configured</li>
            <li>Verify CORS settings if making cross-origin requests</li>
            <li>Check browser console for network errors</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};