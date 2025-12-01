import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scaleService } from "@/services/scaleService";
import { useToast } from "@/hooks/use-toast";

export const HealthCheck = () => {
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const { toast } = useToast();
  
  const checkHealth = async () => {
    setStatus("checking");
    setMessage("Checking connection...");
    
    try {
      const response = await scaleService.healthCheck();
      
      if (response.status === "OK") {
        setStatus("success");
        setMessage(`Connected successfully. Backend says: ${response.service}`);
      } else {
        setStatus("error");
        setMessage(`Unexpected response from backend: ${JSON.stringify(response)}`);
      }
    } catch (error) {
      setStatus("error");
      setMessage(`Connection failed: ${error.message}`);
      
      toast({
        title: "Connection Error",
        description: `Failed to connect to backend: ${error.message}`,
        variant: "destructive"
      });
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
        
        <div className="text-sm text-gray-500">
          <p className="font-medium">Troubleshooting tips:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Ensure the backend server is running on port 8080</li>
            <li>Check if the backend URL is correctly configured</li>
            <li>Verify CORS settings if making cross-origin requests</li>
            <li>Check browser console for network errors</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};