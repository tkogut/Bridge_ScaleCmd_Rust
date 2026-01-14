# ScaleCmdBridge - Windows Installation Guide

Complete guide for installing and managing ScaleCmdBridge on Windows systems.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [MQTT Configuration](#mqtt-configuration)
5. [Mosquitto Installation](#mosquitto-installation)
6. [Service Management](#service-management)
7. [Troubleshooting](#troubleshooting)
8. [MQTT Troubleshooting](#mqtt-troubleshooting)
9. [Uninstallation](#uninstallation)
10. [Updates](#updates)

## Prerequisites

### System Requirements

- **OS:** Windows 10/11 (64-bit)
- **RAM:** Minimum 512 MB
- **Disk Space:** ~50 MB for application + logs
- **Network:** TCP port (default 8080) available
- **Permissions:** Administrator rights for installation

### Software Requirements

- **Windows Service Manager** (built-in)
- **PowerShell 5.1+** (built-in)
- **.NET Framework** (usually pre-installed)

No additional runtime dependencies required - all dependencies are bundled.

## Installation

### Method 1: Automated Installer (Recommended)

1. **Download** `ScaleCmdBridge-Setup-x64.exe` from releases
2. **Right-click** → **Run as Administrator**
3. **Follow the installation wizard:**
   - Accept license agreement
   - Choose installation directory (default: `C:\Program Files\ScaleCmdBridge`)
   - Select port number (default: 8080)
   - Choose optional components:
     - Desktop shortcut
     - Start Menu shortcuts
   - Click **Install**

4. **Installation completes automatically:**
   - Files copied to Program Files
   - Windows Service installed
   - Service started automatically
   - Firewall rule created

5. **Verify installation:**
   ```powershell
   # Check service status
   sc query ScaleCmdBridge
   
   # Check web UI
   Start-Process "http://localhost:8080"
   ```

### Method 2: Manual Installation

For advanced users or custom deployments:

```powershell
# 1. Extract files to installation directory
$installDir = "C:\Program Files\ScaleCmdBridge"
New-Item -ItemType Directory -Path $installDir -Force

# 2. Copy files
# - ScaleCmdBridge.exe
# - nssm.exe
# - web\ directory
# - Service scripts

# 3. Install service
cd $installDir
.\INSTALL-SERVICE.bat

# 4. Configure firewall
netsh advfirewall firewall add rule name="ScaleCmdBridge" dir=in action=allow protocol=TCP localport=8080
```

## Configuration

### Configuration File Location

```
C:\ProgramData\ScaleCmdBridge\config\devices.json
```

### Initial Configuration

The installer creates a default empty configuration. Add devices through the web UI:

1. Open `http://localhost:8080` in your browser
2. Navigate to **Device Configuration**
3. Click **Add New Device**
4. Fill in device details:
   - Device ID (unique identifier)
   - Name, Manufacturer, Model
   - Protocol (RINCMD, DINICMD, etc.)
   - Connection type (TCP or Serial)
   - Connection parameters (host/port or COM port/baud rate)
   - Commands (readGross, readNet, tare, zero)
5. Click **Save**

### Configuration File Format

```json
{
  "devices": {
    "device_id": {
      "name": "Device Name",
      "manufacturer": "Manufacturer",
      "model": "Model",
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
    }
  }
}
```

### Environment Variables

Service environment variables (configured via NSSM):

- `CONFIG_PATH`: Path to devices.json (default: `C:\ProgramData\ScaleCmdBridge\config\devices.json`)
- `WEB_PATH`: Path to web files (default: `C:\Program Files\ScaleCmdBridge\web`)
- `PORT`: Server port (default: 8080)

To modify:
```powershell
cd "C:\Program Files\ScaleCmdBridge"
.\nssm.exe set ScaleCmdBridge AppEnvironmentExtra "PORT=8081"
net restart ScaleCmdBridge
```

## MQTT Configuration

ScaleCmdBridge supports publishing weight readings and receiving commands via MQTT protocol. This enables integration with IoT platforms, Home Assistant, Node-RED, and other MQTT-based systems.

### Enabling MQTT During Installation

During installation, you can enable MQTT by checking the **"Enable MQTT on startup"** option. This automatically configures:

- `MQTT_ENABLED=true`
- `MQTT_BROKER_URL=mqtt://localhost:1883`
- `MQTT_CLIENT_ID=scaleit-bridge`
- `MQTT_TOPIC_PREFIX=scaleit`

### Enabling MQTT After Installation

Use the provided PowerShell script:

```powershell
cd "C:\Program Files\ScaleCmdBridge\scripts"

# Enable MQTT with default settings (local Mosquitto broker)
.\Configure-MQTT-Service.ps1 -Enable

# Enable with custom broker
.\Configure-MQTT-Service.ps1 -Enable -BrokerUrl "mqtt://192.168.1.100:1883"

# Enable with authentication
.\Configure-MQTT-Service.ps1 -Enable -Username "mqttuser" -Password "mqttpass"

# Check current MQTT configuration
.\Configure-MQTT-Service.ps1 -Status

# Disable MQTT
.\Configure-MQTT-Service.ps1 -Disable
```

### MQTT Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MQTT_ENABLED` | Enable/disable MQTT | `false` |
| `MQTT_BROKER_URL` | Broker URL (mqtt:// or mqtts://) | `mqtt://localhost:1883` |
| `MQTT_CLIENT_ID` | Unique client identifier | `scaleit-bridge` |
| `MQTT_TOPIC_PREFIX` | Prefix for all MQTT topics | `scaleit` |
| `MQTT_USERNAME` | Authentication username | (none) |
| `MQTT_PASSWORD` | Authentication password | (none) |
| `MQTT_QOS` | Quality of Service (0, 1, or 2) | `1` |

### MQTT Topics

**Published by Bridge (subscribe to receive):**
- `{prefix}/weight/{device_id}` - Weight readings
- `{prefix}/status/{device_id}` - Device status

**Subscribed by Bridge (publish to send commands):**
- `{prefix}/command/{device_id}` - Commands (readGross, readNet, tare, zero)

### Example: Weight Reading Message

```json
{
  "device_id": "c320tcp",
  "weight": 172.5,
  "unit": "kg",
  "timestamp": 1704067200,
  "is_stable": true
}
```

### Example: Send Command via MQTT

```bash
# Using mosquitto_pub
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" -m '{"device_id":"c320tcp","command":"readGross"}'
```

For detailed MQTT integration guide, see: [MQTT_INTEGRATION.md](MQTT_INTEGRATION.md)

## Mosquitto Installation

ScaleCmdBridge requires an MQTT broker. The recommended broker is **Eclipse Mosquitto**.

### Installing Mosquitto During ScaleCmdBridge Installation

Check the **"Install Mosquitto MQTT Broker"** option during installation. This:
1. Downloads Mosquitto 2.0.18 from official source
2. Installs to `C:\Program Files\mosquitto`
3. Creates Windows Task Scheduler job for auto-start
4. Configures firewall rule for port 1883

### Installing Mosquitto Manually

```powershell
# Run as Administrator
cd "C:\Program Files\ScaleCmdBridge\scripts"
.\Start-Mosquitto-Task.ps1
```

### Mosquitto Configuration

Default configuration file: `C:\Program Files\mosquitto\config\mosquitto.conf`

```conf
# Mosquitto Configuration for ScaleIT Bridge
listener 1883 0.0.0.0
protocol mqtt
allow_anonymous true
persistence true
persistence_location C:\Program Files\mosquitto\data
log_dest file C:\Program Files\mosquitto\logs\mosquitto.log
log_type error
log_type warning
log_type notice
log_type information
max_connections -1
```

### Managing Mosquitto

```powershell
# Start Mosquitto (via Task Scheduler)
Start-ScheduledTask -TaskName "Mosquitto MQTT Broker"

# Stop Mosquitto
Get-Process mosquitto | Stop-Process -Force

# Check if running
Get-Process mosquitto

# View logs
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" -Tail 20

# Uninstall
.\Start-Mosquitto-Task.ps1 -Uninstall
```

### Mosquitto Firewall

The installer creates a firewall rule for port 1883 (Private network profile). For network access from other computers:

```powershell
# Add rule for all profiles (Domain, Private, Public)
netsh advfirewall firewall add rule name="Mosquitto MQTT Broker - Port 1883" dir=in action=allow protocol=TCP localport=1883 profile=any
```

### Testing MQTT Connection

```powershell
# Test port accessibility
Test-NetConnection -ComputerName localhost -Port 1883

# Subscribe to all topics (requires mosquitto-clients)
mosquitto_sub -h localhost -t "scaleit/#" -v

# Publish test message
mosquitto_pub -h localhost -t "test/hello" -m "Hello MQTT"
```

## Service Management

### Using Windows Commands

```powershell
# Start service
net start ScaleCmdBridge

# Stop service
net stop ScaleCmdBridge

# Check status
sc query ScaleCmdBridge

# View detailed status
sc qc ScaleCmdBridge
```

### Using Provided Scripts

```powershell
cd "C:\Program Files\ScaleCmdBridge"

# Start service
.\START-SERVICE.bat

# Stop service
.\STOP-SERVICE.bat

# Reinstall service (if needed)
.\INSTALL-SERVICE.bat

# Remove service
.\UNINSTALL-SERVICE.bat
```

### Service Properties

- **Service Name:** `ScaleCmdBridge`
- **Display Name:** `ScaleIT Bridge Service`
- **Start Type:** Automatic (starts with Windows)
- **Log On:** Local System
- **Recovery:** Restart on failure

## Troubleshooting

### Service Won't Start

```powershell
# Check service status
sc query ScaleCmdBridge

# Check error logs
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 50

# Check Windows Event Viewer
eventvwr.msc
# Navigate to: Windows Logs → Application
# Look for "ScaleCmdBridge" entries
```

**Common causes:**
- Port already in use
- Configuration file syntax error
- Missing dependencies
- Permission issues

### Port Already in Use

```powershell
# Check what's using the port
netstat -ano | findstr :8080

# Change port in service configuration
cd "C:\Program Files\ScaleCmdBridge"
.\nssm.exe set ScaleCmdBridge AppEnvironmentExtra "PORT=8081"
net restart ScaleCmdBridge
```

### Web UI Not Accessible

```powershell
# Check if service is running
sc query ScaleCmdBridge

# Check firewall
netsh advfirewall firewall show rule name="ScaleCmdBridge"

# Test connection
Invoke-WebRequest http://localhost:8080/health

# Check logs
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" -Tail 50
```

### Configuration Errors

```powershell
# Validate JSON syntax
Get-Content "C:\ProgramData\ScaleCmdBridge\config\devices.json" | ConvertFrom-Json

# Check for syntax errors
# Common issues:
# - Missing commas
# - Unclosed brackets
# - Invalid JSON structure
```

### Service Keeps Stopping

```powershell
# Check service recovery settings
sc qfailure ScaleCmdBridge

# Enable automatic restart
sc failure ScaleCmdBridge reset= 86400 actions= restart/60000/restart/60000/restart/60000

# Check application logs
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 100
```

## MQTT Troubleshooting

### MQTT Not Publishing Messages

**Check MQTT is enabled:**
```powershell
cd "C:\Program Files\ScaleCmdBridge\scripts"
.\Configure-MQTT-Service.ps1 -Status
```

**Check logs for MQTT errors:**
```powershell
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" | Select-String "MQTT"
```

**Verify broker is running:**
```powershell
Test-NetConnection -ComputerName localhost -Port 1883
Get-Process mosquitto
```

### Mosquitto Won't Start

**Check Task Scheduler:**
```powershell
Get-ScheduledTask -TaskName "Mosquitto MQTT Broker" | Select-Object State, LastRunTime, LastTaskResult
```

**Check for port conflicts:**
```powershell
netstat -ano | findstr :1883
```

**Check Mosquitto logs:**
```powershell
Get-Content "C:\Program Files\mosquitto\logs\mosquitto.log" -Tail 50
```

**Reinstall Mosquitto:**
```powershell
cd "C:\Program Files\ScaleCmdBridge\scripts"
.\Start-Mosquitto-Task.ps1 -Uninstall
.\Start-Mosquitto-Task.ps1
```

### MQTT Connection Refused

**Causes:**
- Mosquitto broker not running
- Wrong broker URL
- Firewall blocking port 1883
- Authentication required but not configured

**Solutions:**
```powershell
# Start Mosquitto
Start-ScheduledTask -TaskName "Mosquitto MQTT Broker"

# Check firewall rule
Get-NetFirewallRule -DisplayName "*Mosquitto*"

# Add firewall rule if missing
New-NetFirewallRule -DisplayName "Mosquitto MQTT Broker - Port 1883" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 1883 -Profile Private
```

### MQTT Commands Not Executing

**Check subscription is working:**
```powershell
# In Bridge logs, look for "MQTT subscriber" messages
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" | Select-String "MQTT"
```

**Verify command format:**
```json
{
  "device_id": "c320tcp",
  "command": "readGross"
}
```

**Test manually:**
```bash
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" -m '{"device_id":"c320tcp","command":"readGross"}'
```

### Cannot Connect to MQTT from Network

**Check firewall allows external connections:**
```powershell
# Check current rule
Get-NetFirewallRule -DisplayName "*Mosquitto*" | Get-NetFirewallPortFilter

# Add rule for all profiles
netsh advfirewall firewall add rule name="Mosquitto MQTT - Network Access" dir=in action=allow protocol=TCP localport=1883 profile=any
```

**Check Mosquitto is binding to all interfaces:**
```powershell
# Config should have: listener 1883 0.0.0.0
Get-Content "C:\Program Files\mosquitto\config\mosquitto.conf" | Select-String "listener"
```

**Test from another computer:**
```bash
# Replace 192.168.1.50 with your server IP
mosquitto_sub -h 192.168.1.50 -t "test/#" -v
```

### MQTT Performance Issues

**Check QoS setting:**
- QoS 0: Fire and forget (fastest, may lose messages)
- QoS 1: At least once delivery (recommended)
- QoS 2: Exactly once delivery (slowest)

```powershell
.\Configure-MQTT-Service.ps1 -Enable -QoS 1
```

**Check broker resources:**
```powershell
Get-Process mosquitto | Select-Object CPU, WorkingSet64
```

## Uninstallation

### Method 1: Using Uninstaller

1. Open **Settings** → **Apps** → **Apps & features**
2. Find **ScaleCmdBridge**
3. Click **Uninstall**
4. Follow the wizard

### Method 2: Manual Uninstallation

```powershell
# 1. Stop and remove service
cd "C:\Program Files\ScaleCmdBridge"
.\UNINSTALL-SERVICE.bat

# 2. Remove firewall rule
netsh advfirewall firewall delete rule name="ScaleCmdBridge"

# 3. Remove files
Remove-Item "C:\Program Files\ScaleCmdBridge" -Recurse -Force

# 4. (Optional) Remove configuration and logs
Remove-Item "C:\ProgramData\ScaleCmdBridge" -Recurse -Force
```

**Note:** Configuration and logs in `ProgramData` are preserved by default. Remove manually if desired.

## Updates

### Upgrading to New Version

1. **Download** new installer
2. **Run as Administrator**
3. Installer detects existing installation
4. Service is stopped automatically
5. Configuration is backed up automatically
6. Files are replaced
7. Service is restarted automatically

### Preserved During Update

- Configuration file (`devices.json`)
- Log files
- Service settings
- Firewall rules

### Manual Update Process

```powershell
# 1. Backup configuration
$backupPath = "C:\Backups\ScaleCmdBridge_$(Get-Date -Format 'yyyyMMdd')"
New-Item -ItemType Directory -Path $backupPath -Force
Copy-Item "C:\ProgramData\ScaleCmdBridge\config" "$backupPath\config" -Recurse

# 2. Stop service
net stop ScaleCmdBridge

# 3. Run new installer
# (as Administrator)

# 4. Verify
sc query ScaleCmdBridge
Invoke-WebRequest http://localhost:8080/health
```

For detailed update procedures, see: [UPDATE_STRATEGY.md](UPDATE_STRATEGY.md)

## Logs

### Log Locations

- **Service stdout:** `C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log`
- **Service stderr:** `C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log`
- **Application logs:** Configured via `RUST_LOG` environment variable

### Log Rotation

NSSM automatically rotates logs:
- **Max size:** 10 MB per file
- **Rotation:** Daily
- **Retention:** 1 backup file

### Viewing Logs

```powershell
# Real-time log viewing
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" -Wait -Tail 50

# Search logs
Select-String -Path "C:\ProgramData\ScaleCmdBridge\logs\*.log" -Pattern "error"
```

## Security Considerations

### Firewall

The installer automatically creates a firewall rule allowing incoming connections on the configured port. For production:

- **Local only:** Firewall rule restricts to localhost
- **Network access:** Modify firewall rule to allow specific IPs
- **VPN/Remote:** Configure additional firewall rules as needed

### Service Account

The service runs as **Local System** by default. For enhanced security:

1. Create dedicated service account
2. Configure NSSM to use service account:
   ```powershell
   .\nssm.exe set ScaleCmdBridge ObjectName "DOMAIN\ServiceAccount" "Password"
   ```

### Configuration Security

- Configuration file is readable by Local System
- Consider encrypting sensitive connection parameters
- Restrict access to `ProgramData\ScaleCmdBridge` directory

## Support

### Documentation

- **Update Strategy:** [docs/UPDATE_STRATEGY.md](UPDATE_STRATEGY.md)
- **Build Guide:** [BUILD_WINDOWS.md](BUILD_WINDOWS.md)
- **API Reference:** See backend documentation

### Getting Help

1. Check logs for error messages
2. Review troubleshooting section
3. Check Windows Event Viewer
4. Review GitHub issues
5. Contact support

## Quick Reference

### Common Commands

```powershell
# Service management
net start ScaleCmdBridge
net stop ScaleCmdBridge
sc query ScaleCmdBridge

# Configuration
notepad "C:\ProgramData\ScaleCmdBridge\config\devices.json"

# Logs
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" -Tail 50

# Web UI
Start-Process "http://localhost:8080"

# Health check
Invoke-WebRequest http://localhost:8080/health
```

### File Locations

```
Installation:    C:\Program Files\ScaleCmdBridge\
Configuration:   C:\ProgramData\ScaleCmdBridge\config\
Logs:            C:\ProgramData\ScaleCmdBridge\logs\
Service Name:    ScaleCmdBridge
Default Port:    8080
```

