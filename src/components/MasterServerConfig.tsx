import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, CheckCircle2, XCircle, Wifi, WifiOff } from "lucide-react";
import {
  getMasterServerConfig,
  setManualMasterIp,
  getManualMasterIp,
  clearManualMasterIp,
  autoDetectMasterIp,
  testMasterConnection,
} from "@/services/master-discovery";
import { showSuccess, showError } from "@/utils/toast";

interface ServerInfo {
  hostname: string;
  ip_addresses: string[];
  port: number;
  network_mode: string;
  version: string;
}

const MasterServerConfig = () => {
  const [config, setConfig] = useState(getMasterServerConfig());
  const [manualIp, setManualIp] = useState(config.manualIp || "");
  const [manualPort, setManualPort] = useState(config.port || 8080);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState<{ current: number; total: number; ip: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; serverInfo?: ServerInfo } | null>(null);
  const [currentServerInfo, setCurrentServerInfo] = useState<ServerInfo | null>(null);

  // Load current configuration on mount
  useEffect(() => {
    const currentConfig = getMasterServerConfig();
    setConfig(currentConfig);
    setManualIp(currentConfig.manualIp || "");
    setManualPort(currentConfig.port || 8080);
    
    // Test current connection
    testConnection();
  }, []);

  const handleSaveManual = () => {
    if (!manualIp.trim()) {
      showError("Please enter an IP address");
      return;
    }

    // Validate IP format (basic validation)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(manualIp.trim())) {
      showError("Invalid IP address format. Please use format: 192.168.1.100");
      return;
    }

    // Validate port
    const portNum = parseInt(String(manualPort), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      showError("Invalid port number. Please use a number between 1 and 65535");
      return;
    }

    setManualMasterIp(manualIp.trim(), portNum);
    const newConfig = getMasterServerConfig();
    setConfig(newConfig);
    showSuccess(`Master server configured: ${newConfig.url}`);
    
    // Test the new connection
    testConnection();
  };

  const handleClearManual = () => {
    clearManualMasterIp();
    setManualIp("");
    const newConfig = getMasterServerConfig();
    setConfig(newConfig);
    showSuccess("Manual configuration cleared");
    testConnection();
  };

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    setDetectionProgress(null);
    setTestResult(null);

    try {
      const detectedIp = await autoDetectMasterIp((progress) => {
        setDetectionProgress(progress);
      });

      if (detectedIp) {
        const newConfig = getMasterServerConfig();
        setConfig(newConfig);
        showSuccess(`Master server detected: ${detectedIp}`);
        
        // Test the detected connection
        await testConnection();
      } else {
        showError("Could not detect master server. Please configure manually.");
      }
    } catch (error) {
      showError(`Auto-detection failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDetecting(false);
      setDetectionProgress(null);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testMasterConnection();
      setTestResult(result);
      
      if (result.success && result.serverInfo) {
        setCurrentServerInfo(result.serverInfo);
        showSuccess(result.message);
      } else {
        showError(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTestResult({
        success: false,
        message: `Connection test error: ${errorMessage}`,
      });
      showError(`Connection test failed: ${errorMessage}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Master Server Configuration
        </CardTitle>
        <CardDescription>
          Configure the master server (bridge) IP address for network access.
          You can set it manually or use auto-detection to find it automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Configuration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Current Connection</label>
            <Badge variant={testResult?.success ? "default" : "destructive"}>
              {testResult?.success ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : testResult ? (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Disconnected
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Unknown
                </>
              )}
            </Badge>
          </div>
          <div className="p-3 bg-muted rounded-md">
            <code className="text-sm">{config.url}</code>
          </div>
          {currentServerInfo && (
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Hostname:</span> {currentServerInfo.hostname}
              </p>
              <p>
                <span className="font-medium">Version:</span> {currentServerInfo.version}
              </p>
              <p>
                <span className="font-medium">Network Mode:</span> {currentServerInfo.network_mode}
              </p>
              {currentServerInfo.ip_addresses.length > 0 && (
                <p>
                  <span className="font-medium">Available IPs:</span>{" "}
                  {currentServerInfo.ip_addresses.join(", ")}
                </p>
              )}
            </div>
          )}
          {testResult && !testResult.success && (
            <p className="text-sm text-destructive mt-2">{testResult.message}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={isTesting || isDetecting}
            className="w-full"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {/* Auto Detection */}
        <div className="space-y-2 border-t pt-4">
          <label className="text-sm font-medium">Auto-Detection</label>
          <p className="text-sm text-muted-foreground">
            Automatically scan the local network to find the master server.
            This may take a few minutes.
          </p>
          {detectionProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Scanning {detectionProgress.ip}...</span>
                <span>
                  {detectionProgress.current} / {detectionProgress.total}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${(detectionProgress.current / detectionProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleAutoDetect}
            disabled={isDetecting || isTesting}
            className="w-full"
          >
            {isDetecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Auto-Detect Master Server
              </>
            )}
          </Button>
          {config.autoIp && (
            <div className="p-2 bg-muted rounded-md text-sm">
              <span className="text-muted-foreground">Auto-detected IP:</span>{" "}
              <code className="font-mono">{config.autoIp}</code>
            </div>
          )}
        </div>

        {/* Manual Configuration */}
        <div className="space-y-4 border-t pt-4">
          <label className="text-sm font-medium">Manual Configuration</label>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-muted-foreground">IP Address</label>
              <Input
                type="text"
                placeholder="192.168.1.100"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                disabled={isDetecting || isTesting}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Port</label>
              <Input
                type="number"
                placeholder="8080"
                value={manualPort}
                onChange={(e) => setManualPort(parseInt(e.target.value) || 8080)}
                disabled={isDetecting || isTesting}
                min={1}
                max={65535}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveManual}
              disabled={isDetecting || isTesting || !manualIp.trim()}
              className="flex-1"
            >
              Save Configuration
            </Button>
            {config.manualIp && (
              <Button
                variant="outline"
                onClick={handleClearManual}
                disabled={isDetecting || isTesting}
              >
                Clear
              </Button>
            )}
          </div>
          {config.manualIp && (
            <div className="p-2 bg-muted rounded-md text-sm">
              <span className="text-muted-foreground">Manual IP:</span>{" "}
              <code className="font-mono">{config.manualIp}:{config.port}</code>
            </div>
          )}
        </div>

        {/* Configuration Priority */}
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground mb-2">Configuration Priority:</p>
          <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
            <li>Manual configuration (if set)</li>
            <li>Auto-detected IP (if available)</li>
            <li>Current window hostname (if not localhost)</li>
            <li>Fallback to localhost (127.0.0.1)</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default MasterServerConfig;
