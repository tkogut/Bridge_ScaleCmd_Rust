# ScaleIT Bridge - Complete Windows Installation Guide

## Overview

ScaleIT Bridge is a service application that manages scale device connections and provides a web-based interface for configuration and monitoring. This guide covers installation and deployment on Windows systems.

**Components:**
- **Backend**: Rust-based REST API service (runs as Windows Service)
- **Frontend**: React web interface (served from backend)
- **Configuration**: JSON-based device and connection settings

---

## Prerequisites

### System Requirements
- **OS**: Windows 10, Windows 11, or Windows Server 2016+
- **Disk Space**: 500 MB minimum (1 GB recommended)
- **RAM**: 256 MB minimum (1 GB recommended for optimal performance)
- **Network**: TCP port 8080 (configurable)

### Required Software

#### 1. Visual Studio Build Tools (MSVC)
The C++ compiler is needed to build Rust binaries.

**Installation:**

Option A - Using WinGet:
```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e
```

Option B - Using Chocolatey:
```powershell
choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" -y
```

Option C - Manual:
1. Visit https://visualstudio.microsoft.com/downloads/
2. Click "Download Build Tools for Visual Studio 2022"
3. Run installer
4. Check: ☑ "Desktop development with C++"
5. Click "Install"

**Verification:**
```powershell
# Run from Developer PowerShell:
cl.exe /v
link.exe /?
```

#### 2. Rust Toolchain
Required for compiling the backend service.

**Installation:**
1. Download from https://rustup.rs/
2. Run installer (accepts defaults)
3. Close and reopen terminal

**Verification:**
```powershell
rustc --version
cargo --version
```

#### 3. Node.js & npm (for frontend only)
Required only if building from source.

**Installation:**
1. Download from https://nodejs.org/
2. Choose LTS version
3. Run installer (accepts defaults)
4. Close and reopen terminal

**Verification:**
```powershell
node --version
npm --version
```

---

## Building from Source

### Step 1: Prepare Build Environment

Run the prerequisite checker:
```powershell
cd C:\path\to\Bridge_ScaleCmd_Rust
.\Check-Prerequisites.ps1
```

This verifies all required software is installed and configured.

### Step 2: Set Up MSVC Environment

The MSVC compiler must be in your PATH. Two options:

**Option A - Use Developer PowerShell (Recommended):**
1. Search for "Developer PowerShell for Visual Studio 2022"
2. Open it
3. Navigate to project directory
4. Run build

**Option B - Manual Environment Setup:**
```powershell
$env:PATH = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.41.34120\bin\Hostx64\x64;$env:PATH"
```

### Step 3: Build the Project

```powershell
# From project root
.\BUILD.bat
```

This script will:
1. Verify MSVC compiler is available
2. Verify Rust toolchain
3. Compile backend (Rust) - 5-10 minutes
4. Build frontend (React/TypeScript) - 2-3 minutes

**Build Output:**
- Backend: `src-rust\target\release\scaleit-bridge.exe`
- Frontend: `dist\` directory

### Step 4: Create Installer Package

```powershell
# From project root
.\Create-InstallerPackage.ps1 -Version "1.0.0"
```

This creates: `ScaleIT_Bridge_Windows_v1.0.0.zip`

---

## Installation on Target Machine

### Method 1: Automated Installation (Recommended)

**Step 1: Extract Package**
```powershell
$zipPath = "C:\Downloads\ScaleIT_Bridge_Windows_v1.0.0.zip"
Expand-Archive $zipPath -DestinationPath "C:\temp\ScaleIT_Bridge"
cd "C:\temp\ScaleIT_Bridge"
```

**Step 2: Run Installer (as Administrator)**
```powershell
# Right-click on INSTALL.bat, select "Run as administrator"
# OR:
Start-Process "INSTALL.bat" -Verb RunAs
```

The installer will:
- Copy files to `C:\Program Files\ScaleIT_Bridge`
- Create Windows service named "ScaleIT-Bridge"
- Set service to auto-start
- Create `.env` configuration file

**Step 3: Configure**
```powershell
# Edit configuration
notepad "C:\Program Files\ScaleIT_Bridge\.env"
notepad "C:\Program Files\ScaleIT_Bridge\config\devices.json"
```

**Step 4: Start Service**
```powershell
# As Administrator:
net start "ScaleIT-Bridge"
```

**Step 5: Verify Installation**
```powershell
# Check service status
sc query "ScaleIT-Bridge"

# Open web interface
Start-Process "http://localhost:8080"
```

### Method 2: Manual Installation

If you prefer manual setup:

```powershell
# Create directories
New-Item -ItemType Directory -Path "C:\Program Files\ScaleIT_Bridge\bin" -Force
New-Item -ItemType Directory -Path "C:\Program Files\ScaleCmd_Bridge\config" -Force
New-Item -ItemType Directory -Path "C:\Program Files\ScaleIT_Bridge\web" -Force

# Copy files
Copy-Item "bin\scaleit-bridge.exe" "C:\Program Files\ScaleIT_Bridge\bin\"
Copy-Item "config\*" "C:\Program Files\ScaleIT_Bridge\config\"
Copy-Item "web\*" "C:\Program Files\ScaleIT_Bridge\web\" -Recurse

# Create service (as Administrator)
sc create "ScaleIT-Bridge" ^
  binPath= "C:\Program Files\ScaleIT_Bridge\bin\scaleit-bridge.exe" ^
  DisplayName= "ScaleIT Bridge Scale Command Service" ^
  start= auto

# Configure recovery
sc failure "ScaleIT-Bridge" reset= 300 ^
  actions= restart/60000/restart/120000/none

# Start service
net start "ScaleIT-Bridge"
```

---

## Configuration

### Environment Variables (`.env`)

Located at: `C:\Program Files\ScaleIT_Bridge\.env`

```properties
# Configuration file path (relative or absolute)
CONFIG_PATH=config/devices.json

# Logging level: trace, debug, info, warn, error
RUST_LOG=info

# Server port (default 8080)
PORT=8080

# Enable backtrace on panic (1 = full, line = limited)
RUST_BACKTRACE=1

# Number of worker threads (0 = auto-detect)
NUM_WORKERS=0
```

### Device Configuration (`devices.json`)

Located at: `C:\Program Files\ScaleIT_Bridge\config\devices.json`

```json
{
  "devices": {
    "scale_01": {
      "name": "Scale 1",
      "manufacturer": "Rinstrum",
      "model": "C320",
      "protocol": "RINCMD",
      "connection": {
        "connection_type": "Tcp",
        "host": "192.168.1.100",
        "port": 4001,
        "timeout_ms": 5000
      },
      "commands": {
        "readGross": "S",
        "readNet": "N",
        "tare": "T",
        "zero": "Z"
      }
    }
  }
}
```

---

## Service Management

### Start Service
```powershell
net start "ScaleIT-Bridge"
```

### Stop Service
```powershell
net stop "ScaleIT-Bridge"
```

### Restart Service
```powershell
net stop "ScaleIT-Bridge"
timeout /t 2
net start "ScaleIT-Bridge"
```

### Check Status
```powershell
sc query "ScaleIT-Bridge"
```

### View Service Details
```powershell
sc qc "ScaleIT-Bridge"
```

### Change Service Startup Type
```powershell
# Auto-start on boot
sc config "ScaleIT-Bridge" start= auto

# Manual start
sc config "ScaleIT-Bridge" start= demand

# Disabled
sc config "ScaleIT-Bridge" start= disabled
```

### Uninstall Service
```powershell
net stop "ScaleIT-Bridge"
sc delete "ScaleIT-Bridge"
```

---

## Accessing the Web Interface

### Local Access
```
http://localhost:8080
```

### Remote Access
```
http://<computer-name>:8080
http://<ip-address>:8080
```

### Firewall Configuration

Allow port 8080 through Windows Firewall:

```powershell
# Create inbound rule
New-NetFirewallRule -DisplayName "ScaleIT Bridge" ^
  -Direction Inbound ^
  -LocalPort 8080 ^
  -Protocol TCP ^
  -Action Allow
```

---

## Troubleshooting

### Service Won't Start

**Check logs:**
```powershell
# View Event Viewer
Get-EventLog -LogName Application -Source "ScaleIT*" -Newest 10 | Format-Table

# Or open Event Viewer manually:
eventvwr.msc
```

**Check configuration:**
```powershell
# Verify files exist
Test-Path "C:\Program Files\ScaleIT_Bridge\bin\scaleit-bridge.exe"
Test-Path "C:\Program Files\ScaleIT_Bridge\config\devices.json"

# Check .env syntax
notepad "C:\Program Files\ScaleIT_Bridge\.env"
```

**Check permissions:**
```powershell
# Service needs read/write access to config directory
icacls "C:\Program Files\ScaleIT_Bridge\config" /grant "NETWORK SERVICE:(OI)(CI)M"
```

### Port Already in Use

```powershell
# Find process using port 8080
netstat -ano | findstr 8080

# Kill process (if safe)
Stop-Process -Id <PID> -Force
```

### Can't Access Web Interface

```powershell
# Verify service is running
sc query "ScaleIT-Bridge" | findstr "STATE"

# Check if port is listening
netstat -ano | findstr 8080

# Test localhost connection
Invoke-WebRequest "http://localhost:8080/health"

# Check firewall
Get-NetFirewallRule | Where-Object DisplayName -match "ScaleIT"
```

### Device Connection Failures

**Check device configuration:**
```json
{
  "connection": {
    "connection_type": "Tcp",
    "host": "192.168.1.100",
    "port": 4001,
    "timeout_ms": 5000
  }
}
```

**Verify device connectivity:**
```powershell
# Test TCP connection
Test-NetConnection -ComputerName "192.168.1.100" -Port 4001

# If unsuccessful, check:
# 1. Device is powered on and network-connected
# 2. IP address is correct
# 3. Port number is correct
# 4. Firewall allows connection
```

### Invalid Configuration

**Validate JSON syntax:**
```powershell
# Test JSON file
$config = Get-Content "config\devices.json" -Raw | ConvertFrom-Json
$config | ConvertTo-Json -Depth 10
```

---

## Updating

### Update Service

```powershell
# Stop service
net stop "ScaleIT-Bridge"

# Backup current installation
Copy-Item "C:\Program Files\ScaleIT_Bridge" `
  "C:\Program Files\ScaleIT_Bridge.backup" -Recurse

# Extract new package
Expand-Archive "ScaleIT_Bridge_Windows_v1.1.0.zip" -DestinationPath "C:\temp\new_version"

# Copy new binary
Copy-Item "C:\temp\new_version\bin\scaleit-bridge.exe" `
  "C:\Program Files\ScaleIT_Bridge\bin\" -Force

# Restart service
net start "ScaleIT-Bridge"

# Verify
sc query "ScaleIT-Bridge"
```

### Backup Configuration

```powershell
# Backup before updates
$backupPath = "C:\Backups\ScaleIT_Bridge_$(Get-Date -Format yyyyMMdd_HHmmss)"
Copy-Item "C:\Program Files\ScaleIT_Bridge\config" $backupPath -Recurse
```

---

## Uninstallation

```powershell
# Stop service (as Administrator)
net stop "ScaleIT-Bridge"

# Remove service
sc delete "ScaleIT-Bridge"

# Remove files
Remove-Item "C:\Program Files\ScaleIT_Bridge" -Recurse -Force

# Remove firewall rule (optional)
Remove-NetFirewallRule -DisplayName "ScaleIT Bridge" -Confirm:$false
```

---

## Performance Tuning

### Increase Worker Threads
```properties
# In .env
NUM_WORKERS=4  # Match CPU core count
```

### Adjust Timeouts
```json
{
  "connection": {
    "timeout_ms": 10000  // Increase for slow networks
  }
}
```

### Enable Debug Logging
```properties
# In .env (be careful - generates large logs)
RUST_LOG=debug
```

---

## Monitoring

### Service Status Script

```powershell
# Save as monitor.ps1
while ($true) {
    $status = (Get-Service "ScaleIT-Bridge").Status
    Write-Host "$(Get-Date): Service is $status"
    
    if ($status -ne "Running") {
        Write-Host "⚠ Service is not running!"
        Start-Service "ScaleIT-Bridge"
    }
    
    Start-Sleep -Seconds 60
}
```

### Health Check

```powershell
# Check API health endpoint
Invoke-WebRequest "http://localhost:8080/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

---

## Support & Documentation

### Project Resources
- **Repository**: [GitHub URL]
- **Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share ideas

### Documentation Files
- `README.md` - Quick start guide
- `BUILD_WINDOWS.md` - Detailed build instructions
- `BACKEND_GUIDELINES.md` - Backend API specifications
- `CONTRIBUTING.md` - Development guidelines

---

## Appendix

### Default Ports
- Web UI: 8080
- Rinstrum C320 (TCP): 4001

### File Locations
- Installation: `C:\Program Files\ScaleIT_Bridge`
- Configuration: `C:\Program Files\ScaleIT_Bridge\config\devices.json`
- Logs: Event Viewer → Windows Logs → Application
- Service Binary: `C:\Program Files\ScaleIT_Bridge\bin\scaleit-bridge.exe`

### Common Commands Reference
```powershell
# Start service
net start "ScaleIT-Bridge"

# Stop service
net stop "ScaleIT-Bridge"

# Check status
sc query "ScaleIT-Bridge"

# View last 10 log entries
Get-EventLog -LogName Application -Source "ScaleIT*" -Newest 10

# Test web server
Invoke-WebRequest "http://localhost:8080/health"

# Test device connection
Test-NetConnection -ComputerName "192.168.1.100" -Port 4001
```

---

**Last Updated**: November 25, 2025
**Version**: 1.0.0
