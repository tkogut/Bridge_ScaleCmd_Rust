# ScaleIT Bridge - Integration Guide for Caffeine.ai (Motoko)

## Overview

ScaleIT Bridge is a Rust-based backend service that provides a REST API for communicating with industrial scales (Dini Argeo, Rinstrum, etc.) via TCP/IP or Serial connections. This guide provides complete instructions for integrating Bridge with a frontend application deployed on cloud platforms like Vercel, including solutions to common CORS and Mixed Content issues.

## Architecture

```
Frontend (Vercel/Caffeine) [HTTPS]
    ↓
Bridge API (localhost:8080) [HTTP]
    ↓
Industrial Scales (TCP/Serial)
```

**Key Points:**
- Bridge runs locally on `http://localhost:8080` or `http://0.0.0.0:8080`
- Bridge supports both TCP/IP and Serial port connections
- Bridge automatically handles CORS for all origins
- Frontend deployed on HTTPS (Vercel) must handle Mixed Content (HTTPS → HTTP)

---

## API Endpoints

### Base URL
- **Local**: `http://localhost:8080` or `http://127.0.0.1:8080`
- **Network**: `http://YOUR_COMPUTER_IP:8080` (e.g., `http://192.168.1.100:8080`)

### 1. Health Check
**GET** `/health`

Check if Bridge service is running.

**Response:**
```json
{
  "status": "OK" | "ERROR" | "STOPPED" | "BLOCKED",
  "service": "ScaleIT Bridge",
  "version": "0.1.0"
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:8080/health');
const health = await response.json();
console.log(health.status); // "OK"
```

---

### 2. List Devices
**GET** `/devices`

Get list of all configured scale devices.

**Response:**
```json
{
  "success": true,
  "devices": [
    ["device_id", "device_name", "device_model"],
    ["scale1", "Main Scale", "Dini Argeo C320"]
  ]
}
```

**TypeScript Interface:**
```typescript
interface DevicesResponse {
  success: boolean;
  devices: [string, string, string][]; // [id, name, model]
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:8080/devices');
const data: DevicesResponse = await response.json();
data.devices.forEach(([id, name, model]) => {
  console.log(`${name} (${id}): ${model}`);
});
```

---

### 3. Execute Scale Command
**POST** `/scalecmd`

Execute a command on a scale device (read weight, tare, zero, etc.).

**Request Body:**
```json
{
  "device_id": "scale1",
  "command": "readGross" | "readNet" | "tare" | "zero"
}
```

**Response (Success):**
```json
{
  "success": true,
  "device_id": "scale1",
  "command": "readGross",
  "result": {
    "gross_weight": 123.45,
    "net_weight": 123.45,
    "unit": "kg",
    "is_stable": true,
    "timestamp": "2025-12-19T10:30:00Z"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "device_id": "scale1",
  "command": "readGross",
  "result": null,
  "error": "Connection timeout to device"
}
```

**TypeScript Interfaces:**
```typescript
type Command = "readGross" | "readNet" | "tare" | "zero";

interface ScaleCommandRequest {
  device_id: string;
  command: Command;
}

interface WeightReading {
  gross_weight: number;
  net_weight: number;
  unit: string;
  is_stable: boolean;
  timestamp: string;
}

interface ScaleCommandResponse {
  success: boolean;
  device_id: string;
  command: Command;
  result?: WeightReading | { message: string };
  error?: string;
}
```

**Example:**
```typescript
async function readWeight(deviceId: string): Promise<WeightReading> {
  const response = await fetch('http://localhost:8080/scalecmd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: deviceId,
      command: 'readGross'
    })
  });
  
  const data: ScaleCommandResponse = await response.json();
  
  if (!data.success || !data.result) {
    throw new Error(data.error || 'Command failed');
  }
  
  // Type guard for WeightReading
  if ('gross_weight' in data.result) {
    return data.result as WeightReading;
  }
  
  throw new Error('Invalid response format');
}
```

---

### 4. Get Device Configuration
**GET** `/api/config`

Get detailed configuration for all devices.

**Response:**
```json
{
  "device_id": {
    "name": "Main Scale",
    "manufacturer": "Dini Argeo",
    "model": "C320",
    "protocol": "ASCII",
    "connection": {
      "connection_type": "Tcp",
      "host": "192.168.1.254",
      "port": 4001
    },
    "timeout_ms": 5000,
    "commands": {
      "readGross": "READ",
      "readNet": "REXT",
      "tare": "TARE",
      "zero": "ZERO"
    },
    "enabled": true
  }
}
```

**TypeScript Interface:**
```typescript
interface TcpConnection {
  connection_type: "Tcp";
  host: string;
  port: number;
}

interface SerialConnection {
  connection_type: "Serial";
  port: string;
  baud_rate: number;
  data_bits?: number;
  stop_bits?: "one" | "two";
  parity?: "none" | "even" | "odd";
  flow_control?: "none" | "software" | "hardware";
}

interface DeviceConfig {
  name: string;
  manufacturer: string;
  model: string;
  protocol: string;
  connection: TcpConnection | SerialConnection;
  timeout_ms: number;
  commands: Record<string, string>;
  enabled: boolean;
}
```

---

### 5. Save Device Configuration
**POST** `/api/config/save`

Add or update device configuration.

**Request Body:**
```json
{
  "device_id": "scale1",
  "config": {
    "name": "Main Scale",
    "manufacturer": "Dini Argeo",
    "model": "C320",
    "protocol": "ASCII",
    "connection": {
      "connection_type": "Tcp",
      "host": "192.168.1.254",
      "port": 4001
    },
    "timeout_ms": 5000,
    "commands": {
      "readGross": "READ",
      "readNet": "REXT",
      "tare": "TARE",
      "zero": "ZERO"
    },
    "enabled": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration for scale1 saved and reloaded."
}
```

---

### 6. Delete Device Configuration
**DELETE** `/api/config/{device_id}`

Remove a device configuration.

**Example:**
```typescript
await fetch(`http://localhost:8080/api/config/scale1`, {
  method: 'DELETE'
});
```

---

## Critical Issues and Solutions

### Problem 1: Mixed Content (HTTPS → HTTP)

**Symptom:**
- Frontend on Vercel (HTTPS) cannot connect to Bridge (HTTP)
- Browser shows: `ERR_BLOCKED_BY_CLIENT` or `Mixed Content` error
- Status shows "BLOCKED" in health check

**Root Cause:**
Modern browsers block HTTP requests from HTTPS pages for security. This is called "Mixed Content" blocking.

**Solutions:**

#### Solution A: Use Environment Variable (Recommended for Production)

Configure Bridge URL via environment variable in your deployment platform.

**Vercel:**
1. Go to Project → Settings → Environment Variables
2. Add: `VITE_BRIDGE_URL` = `http://YOUR_COMPUTER_IP:8080`
3. Redeploy

**Code:**
```typescript
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'http://127.0.0.1:8080';
```

#### Solution B: Use IP Address Instead of localhost

Some browsers handle IP addresses differently than `localhost`.

```typescript
// Instead of: http://localhost:8080
// Use: http://127.0.0.1:8080
// Or: http://192.168.1.100:8080 (your computer's IP)
const BRIDGE_URL = 'http://127.0.0.1:8080';
```

#### Solution C: Use HTTPS Tunnel (Best for Production)

Use a tunnel service to expose Bridge via HTTPS:

**ngrok:**
```bash
ngrok http 8080
# Use the HTTPS URL: https://xxxx.ngrok.io
```

**Cloudflare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:8080
```

Then use the HTTPS URL in your frontend.

#### Solution D: User Instructions (Fallback)

Show instructions to users on how to allow Mixed Content in their browser:

**Chrome/Edge:**
1. Click the lock icon in address bar
2. Select "Site settings" → "Allow unsafe content"
3. Or click "Allow" in the dialog that appears

**Brave:**
1. Click the shield icon next to address bar
2. Toggle "Shields" to "Off" for this site
3. Or go to: `brave://settings/content` and add exception for localhost

**Firefox:**
1. Click the lock icon in address bar
2. Click "Disable protection for this page"

**Implementation:**
```typescript
// Detect Mixed Content error
if (error.message.includes('Failed to fetch') && 
    window.location.protocol === 'https:') {
  // Show instructions to user
  showMixedContentInstructions();
}
```

---

### Problem 2: CORS (Cross-Origin Resource Sharing)

**Symptom:**
- Browser shows: `CORS policy: No 'Access-Control-Allow-Origin' header`
- Requests fail with CORS error

**Root Cause:**
Bridge must send proper CORS headers to allow cross-origin requests.

**Solution:**
Bridge is already configured to allow all origins:

```rust
// Bridge automatically handles CORS
let cors = Cors::default()
    .allow_any_origin()
    .allow_any_method()
    .allow_any_header()
    .max_age(3600);
```

**If CORS errors still occur:**
1. Ensure Bridge is running and accessible
2. Check that Bridge is listening on `0.0.0.0:8080` (not just `127.0.0.1`)
3. Verify firewall allows connections on port 8080

---

### Problem 3: Network Accessibility

**Symptom:**
- Frontend cannot reach Bridge
- Connection timeout or connection refused

**Solutions:**

#### Check Bridge is Running
```typescript
async function checkBridgeHealth(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8080/health', {
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    const health = await response.json();
    return health.status === 'OK';
  } catch (error) {
    console.error('Bridge not accessible:', error);
    return false;
  }
}
```

#### Use Computer's IP Address
If frontend is on a different machine or network:

1. Find your computer's IP:
   ```powershell
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. Use IP in Bridge URL:
   ```typescript
   const BRIDGE_URL = 'http://192.168.1.100:8080';
   ```

3. Ensure Bridge listens on all interfaces:
   - Bridge already configured to listen on `0.0.0.0:8080`
   - This allows connections from any network interface

#### Firewall Configuration
Ensure Windows Firewall allows connections on port 8080:

```powershell
# Check firewall rules
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*8080*"}

# If needed, add rule (run as Administrator)
New-NetFirewallRule -DisplayName "ScaleIT Bridge 8080" `
  -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

---

## Complete Integration Example

### TypeScript/React Example

```typescript
// bridge-client.ts
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'http://127.0.0.1:8080';

interface ScaleCommandRequest {
  device_id: string;
  command: 'readGross' | 'readNet' | 'tare' | 'zero';
}

interface WeightReading {
  gross_weight: number;
  net_weight: number;
  unit: string;
  is_stable: boolean;
  timestamp: string;
}

interface ScaleCommandResponse {
  success: boolean;
  device_id: string;
  command: string;
  result?: WeightReading;
  error?: string;
}

class BridgeClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = BRIDGE_URL) {
    this.baseUrl = baseUrl;
  }
  
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
    return await response.json();
  }
  
  async getDevices(): Promise<Array<[string, string, string]>> {
    const response = await fetch(`${this.baseUrl}/devices`);
    if (!response.ok) throw new Error(`Failed to fetch devices: ${response.status}`);
    const data = await response.json();
    return data.devices;
  }
  
  async executeCommand(
    deviceId: string, 
    command: ScaleCommandRequest['command']
  ): Promise<WeightReading> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    try {
      const response = await fetch(`${this.baseUrl}/scalecmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, command }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data: ScaleCommandResponse = await response.json();
      
      if (!data.success || !data.result) {
        throw new Error(data.error || 'Command failed');
      }
      
      if ('gross_weight' in data.result) {
        return data.result as WeightReading;
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout: Bridge did not respond within 30 seconds');
        }
        
        // Check for Mixed Content
        if (error.message.includes('Failed to fetch') && 
            window.location.protocol === 'https:') {
          throw new Error('MIXED_CONTENT_BLOCKED: Browser is blocking HTTP connection from HTTPS page. Please allow Mixed Content in browser settings.');
        }
      }
      
      throw error;
    }
  }
  
  async readGrossWeight(deviceId: string): Promise<WeightReading> {
    return this.executeCommand(deviceId, 'readGross');
  }
  
  async readNetWeight(deviceId: string): Promise<WeightReading> {
    return this.executeCommand(deviceId, 'readNet');
  }
  
  async tare(deviceId: string): Promise<WeightReading> {
    return this.executeCommand(deviceId, 'tare');
  }
  
  async zero(deviceId: string): Promise<WeightReading> {
    return this.executeCommand(deviceId, 'zero');
  }
}

// Usage
const bridge = new BridgeClient();

// Check if Bridge is running
try {
  const health = await bridge.healthCheck();
  console.log(`Bridge ${health.version} is ${health.status}`);
} catch (error) {
  console.error('Bridge not accessible:', error);
}

// Read weight
try {
  const weight = await bridge.readGrossWeight('scale1');
  console.log(`Weight: ${weight.gross_weight} ${weight.unit}`);
  console.log(`Stable: ${weight.is_stable}`);
} catch (error) {
  if (error.message.includes('MIXED_CONTENT_BLOCKED')) {
    // Show user instructions
    alert('Please allow Mixed Content in your browser settings');
  } else {
    console.error('Failed to read weight:', error);
  }
}
```

---

## Error Handling Best Practices

### 1. Timeout Handling
Always set timeouts for Bridge requests:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds

try {
  const response = await fetch(url, {
    signal: controller.signal,
    // ... other options
  });
  clearTimeout(timeoutId);
  // ... handle response
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    // Handle timeout
  }
}
```

### 2. Mixed Content Detection
Detect and handle Mixed Content errors:

```typescript
function isMixedContentError(error: Error): boolean {
  return (
    window.location.protocol === 'https:' &&
    (error.message.includes('Failed to fetch') ||
     error.message.includes('ERR_BLOCKED_BY_CLIENT') ||
     error.message.includes('NetworkError'))
  );
}

try {
  await bridge.readGrossWeight('scale1');
} catch (error) {
  if (isMixedContentError(error)) {
    // Show user instructions or use fallback
    showMixedContentInstructions();
  } else {
    // Handle other errors
    console.error('Error:', error);
  }
}
```

### 3. Retry Logic
Implement retry logic for transient errors:

```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Environment Configuration

### Development
```env
VITE_BRIDGE_URL=http://127.0.0.1:8080
```

### Production (Vercel)
```env
VITE_BRIDGE_URL=http://192.168.1.100:8080
# Or use HTTPS tunnel:
# VITE_BRIDGE_URL=https://xxxx.ngrok.io
```

### Production (HTTPS Tunnel)
```env
VITE_BRIDGE_URL=https://bridge.yourdomain.com
```

---

## Testing Checklist

Before deploying to production:

- [ ] Bridge is running and accessible on `http://localhost:8080`
- [ ] Health check returns `{"status": "OK"}`
- [ ] Can list devices via `/devices` endpoint
- [ ] Can execute commands via `/scalecmd` endpoint
- [ ] CORS headers are present in responses
- [ ] Mixed Content handling is implemented
- [ ] Error handling covers all edge cases
- [ ] Timeout handling is configured
- [ ] Environment variables are set correctly
- [ ] Firewall allows connections on port 8080
- [ ] Bridge listens on `0.0.0.0:8080` (not just `127.0.0.1`)

---

## Troubleshooting

### Bridge not accessible
1. Check if Bridge is running: `netstat -ano | findstr :8080`
2. Check firewall rules
3. Verify Bridge listens on `0.0.0.0:8080`
4. Try using IP address instead of `localhost`

### Mixed Content errors
1. Use environment variable `VITE_BRIDGE_URL` with IP address
2. Or use HTTPS tunnel (ngrok, Cloudflare Tunnel)
3. Or show user instructions to allow Mixed Content

### CORS errors
1. Verify Bridge is running (CORS is handled automatically)
2. Check network connectivity
3. Ensure Bridge is accessible from frontend's network

### Timeout errors
1. Increase timeout in Bridge configuration (`timeout_ms` in device config)
2. Check network latency
3. Verify device is connected and responsive

---

## Additional Resources

- Bridge Repository: `https://github.com/tkogut/Bridge_ScaleCmd_Rust`
- API Documentation: See `src/types/api.ts` for TypeScript interfaces
- Troubleshooting Guide: See `docs/TROUBLESHOOTING.md`
- Network Troubleshooting: See `docs/NETWORK_TROUBLESHOOTING.md`

---

## Internet Computer (Motoko) Integration - CRITICAL

### ⚠️ Important: Internet Computer Limitations

**Internet Computer canisters CANNOT directly connect to HTTP endpoints!**

The error you're seeing:
```
Connecting to caffeine-ai-broker.run.goorm.site failed: DNS error
```

This happens because:
1. **IC canisters can only make HTTPS outbound calls** (not HTTP)
2. **IC requires whitelisted domains** for HTTP outcalls
3. **Direct HTTP connections from canisters are blocked** for security

### Solution: Use Frontend as Proxy (Recommended)

**Architecture:**
```
User Browser [HTTPS]
    ↓
Caffeine.ai Frontend [HTTPS] 
    ↓ (fetch from browser)
Bridge API (localhost:8080) [HTTP]
    ↓
Industrial Scales
```

**Implementation:**

#### 1. Frontend Proxy Function (TypeScript/JavaScript)

Create a proxy function in your frontend that calls Bridge API:

```typescript
// frontend/src/services/bridge-proxy.ts
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'http://127.0.0.1:8080';

export async function callBridgeAPI(
  endpoint: string, 
  options?: RequestInit
): Promise<Response> {
  // Frontend (browser) can call HTTP endpoints
  const url = `${BRIDGE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Bridge API error: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

// Wrapper functions
export async function getBridgeHealth() {
  const response = await callBridgeAPI('/health');
  return await response.json();
}

export async function getDevices() {
  const response = await callBridgeAPI('/devices');
  return await response.json();
}

export async function executeScaleCommand(deviceId: string, command: string) {
  const response = await callBridgeAPI('/scalecmd', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, command }),
  });
  return await response.json();
}
```

#### 2. Motoko Canister - Expose Query/Update Methods

In your Motoko canister, expose methods that the frontend can call:

```motoko
// Main.mo
import Text "mo:base/Text";
import Result "mo:base/Result";

actor ScaleService {
  
  // Frontend will call this, then proxy to Bridge
  public query func getHealthStatus() : async Text {
    // Return status - frontend will check Bridge
    return "Frontend will check Bridge health";
  };
  
  // Store weight reading from frontend
  private var lastWeightReading : ?WeightReading = null;
  
  public type WeightReading = {
    gross_weight : Float;
    net_weight : Float;
    unit : Text;
    is_stable : Bool;
    timestamp : Text;
  };
  
  // Frontend calls Bridge, then calls this to store result
  public func storeWeightReading(reading : WeightReading) : async () {
    lastWeightReading := ?reading;
  };
  
  public query func getLastWeightReading() : async ?WeightReading {
    return lastWeightReading;
  };
  
  // Frontend will handle Bridge communication
  public func requestWeightReading(deviceId : Text, command : Text) : async Text {
    // Return instruction for frontend to call Bridge
    return "Frontend should call Bridge API and then storeWeightReading()";
  };
}
```

#### 3. Frontend Integration (React/TypeScript)

```typescript
// frontend/src/components/ScaleControl.tsx
import { callBridgeAPI, executeScaleCommand } from '@/services/bridge-proxy';
import { actor } from '@/services/ic-agent'; // Your IC agent setup

async function handleReadWeight(deviceId: string) {
  try {
    // 1. Call Bridge API from frontend (browser can access HTTP)
    const bridgeResponse = await executeScaleCommand(deviceId, 'readGross');
    
    if (bridgeResponse.success && bridgeResponse.result) {
      // 2. Store result in IC canister
      const weightReading = {
        gross_weight: bridgeResponse.result.gross_weight,
        net_weight: bridgeResponse.result.net_weight,
        unit: bridgeResponse.result.unit,
        is_stable: bridgeResponse.result.is_stable,
        timestamp: bridgeResponse.result.timestamp,
      };
      
      await actor.storeWeightReading(weightReading);
      
      return weightReading;
    } else {
      throw new Error(bridgeResponse.error || 'Command failed');
    }
  } catch (error) {
    console.error('Error reading weight:', error);
    throw error;
  }
}
```

### Alternative Solution: HTTPS Tunnel for Bridge

If you need canister to directly call Bridge, you MUST use HTTPS:

#### Step 1: Set up HTTPS Tunnel

```bash
# Using ngrok
ngrok http 8080

# Or Cloudflare Tunnel
cloudflared tunnel --url http://localhost:8080
```

#### Step 2: Configure IC HTTP Outcalls

In your `dfx.json` or canister configuration, whitelist the HTTPS domain:

```json
{
  "canisters": {
    "your_canister": {
      "http_outcalls": {
        "allowed_urls": [
          "https://your-bridge-tunnel.ngrok.io",
          "https://bridge.yourdomain.com"
        ]
      }
    }
  }
}
```

#### Step 3: Use HTTPS Outcalls in Motoko

```motoko
import HTTP "mo:base/Http";
import Text "mo:base/Text";

actor ScaleService {
  let bridgeUrl = "https://your-bridge-tunnel.ngrok.io";
  
  public func readWeight(deviceId : Text) : async Result.Result<WeightReading, Text> {
    let url = bridgeUrl # "/scalecmd";
    let body = Text.encodeUtf8(
      "{ \"device_id\": \"" # deviceId # "\", \"command\": \"readGross\" }"
    );
    
    let request : HTTP.Request = {
      method = "POST";
      url = url;
      headers = [
        ("Content-Type", "application/json")
      ];
      body = body;
    };
    
    // Use HTTPS outcall
    switch (await HTTP.http_request(request)) {
      case (#ok response) {
        // Parse JSON response
        // Return WeightReading
      };
      case (#err error) {
        return #err("HTTP error: " # debug_show(error));
      };
    };
  };
}
```

### Recommended Architecture for Caffeine.ai

**Best Practice: Frontend Proxy Pattern**

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────────────┐
│  Caffeine.ai Frontend   │  ← React/TypeScript
│  (Vercel/IC Frontend)   │
└─────┬───────────┬───────┘
      │           │
      │ HTTPS     │ HTTPS (update call)
      ↓           ↓
┌──────────┐  ┌──────────────────┐
│  Bridge  │  │  IC Canister     │
│  (HTTP)  │  │  (Motoko)        │
└──────────┘  └──────────────────┘
```

**Flow:**
1. User clicks "Read Weight" in frontend
2. Frontend calls Bridge API directly (browser → HTTP Bridge) ✅
3. Frontend receives weight reading
4. Frontend calls IC canister to store result (browser → HTTPS IC) ✅
5. IC canister stores data on-chain

**Why this works:**
- Browser can access HTTP endpoints (with Mixed Content handling)
- Browser can access HTTPS IC canisters
- No need for IC HTTP outcalls
- Simpler architecture
- Better error handling

### Error Handling for Caffeine.ai

```typescript
// frontend/src/services/bridge-proxy.ts
export async function callBridgeAPIWithRetry(
  endpoint: string,
  options?: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callBridgeAPI(endpoint, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Check for Mixed Content
      if (error.message.includes('Failed to fetch') && 
          window.location.protocol === 'https:') {
        throw new Error('MIXED_CONTENT_BLOCKED: Please allow Mixed Content in browser settings');
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Configuration for Caffeine.ai

**Environment Variables (Frontend):**
```env
# For local development
VITE_BRIDGE_URL=http://127.0.0.1:8080

# For production (use your computer's IP)
VITE_BRIDGE_URL=http://192.168.1.100:8080

# Or use HTTPS tunnel
VITE_BRIDGE_URL=https://bridge-tunnel.ngrok.io
```

**Important Notes:**
1. **Never call Bridge API directly from Motoko canister** (unless using HTTPS tunnel)
2. **Always use frontend as proxy** for HTTP Bridge endpoints
3. **Store results in IC canister** after receiving from Bridge
4. **Handle Mixed Content** if frontend is HTTPS and Bridge is HTTP
5. **Use environment variables** for Bridge URL configuration

---

## Summary for Caffeine.ai Agent

**Key Points:**
1. **IC canisters CANNOT call HTTP endpoints directly** - use frontend proxy
2. Bridge API runs on `http://localhost:8080` (local) or `http://IP:8080` (network)
3. All endpoints support CORS automatically
4. Mixed Content (HTTPS → HTTP) must be handled via:
   - Environment variable with IP address
   - HTTPS tunnel
   - User instructions
5. Always implement timeout handling (30 seconds recommended)
6. Use proper error handling for network errors
7. Bridge supports TCP/IP and Serial connections
8. Commands: `readGross`, `readNet`, `tare`, `zero`

**Recommended Approach for Caffeine.ai:**
1. **Use Frontend Proxy Pattern:**
   - Frontend (browser) calls Bridge API directly
   - Frontend calls IC canister to store results
   - No direct IC → Bridge communication needed
2. Use environment variable `VITE_BRIDGE_URL` for Bridge URL
3. Implement Mixed Content detection and user instructions
4. Use IP address instead of `localhost` for network access
5. Implement retry logic for transient errors
6. Always set timeouts for API calls

**Architecture Pattern:**
```
Browser → Frontend → Bridge (HTTP) ✅
Browser → Frontend → IC Canister (HTTPS) ✅
IC Canister → Bridge (HTTP) ❌ NOT POSSIBLE
IC Canister → Bridge (HTTPS Tunnel) ✅ POSSIBLE but complex
```

