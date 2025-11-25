#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Creates a distributable Windows installer package for ScaleIT Bridge

.DESCRIPTION
    This script packages the compiled binaries, configuration, and frontend
    into a ready-to-distribute installer package for Windows.

.PARAMETER Version
    Version string for the package (default: from package.json)

.PARAMETER OutputPath
    Path where the installer package will be created (default: current directory)

.EXAMPLE
    .\Create-InstallerPackage.ps1 -Version "1.0.0"
#>

param(
    [string]$Version = "1.0.0",
    [string]$OutputPath = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$InformationPreference = "Continue"

# Script variables
$ScriptDir = Split-Path -Parent (Resolve-Path $PSCommandPath)
$BackendBinary = Join-Path $ScriptDir "src-rust\target\release\scaleit-bridge.exe"
$FrontendDir = Join-Path $ScriptDir "dist"
$ConfigFile = Join-Path $ScriptDir "src-rust\config\devices.json"
$PackageName = "ScaleIT_Bridge_Windows_v$Version"
$PackageDir = Join-Path $OutputPath $PackageName

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "ScaleIT Bridge - Installer Package Creator" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check prerequisites
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Cyan

if (-not (Test-Path $BackendBinary)) {
    Write-Host "ERROR: Backend binary not found at $BackendBinary" -ForegroundColor Red
    Write-Host "Please run: .\BUILD.bat" -ForegroundColor Yellow
    exit 1
}
Write-Host "  * Backend binary found" -ForegroundColor Green

if (-not (Test-Path $ConfigFile)) {
    Write-Host "WARNING: Config file not found at $ConfigFile" -ForegroundColor Yellow
    Write-Host "  A default config will be created" -ForegroundColor Yellow
} else {
    Write-Host "  * Configuration file found" -ForegroundColor Green
}

if (-not (Test-Path $FrontendDir)) {
    Write-Host "WARNING: Frontend dist not found at $FrontendDir" -ForegroundColor Yellow
    Write-Host "  Please run: npm run build" -ForegroundColor Yellow
} else {
    Write-Host "  * Frontend build found" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/5] Creating package directory..." -ForegroundColor Cyan

if (Test-Path $PackageDir) {
    Write-Host "  Removing existing package directory..."
    Remove-Item $PackageDir -Recurse -Force | Out-Null
}

New-Item -ItemType Directory -Path $PackageDir | Out-Null
Write-Host "  * Package directory created: $PackageDir" -ForegroundColor Green

Write-Host ""
Write-Host "[3/5] Copying files..." -ForegroundColor Cyan

# Create subdirectories
$null = New-Item -ItemType Directory -Path "$PackageDir\bin" -Force
$null = New-Item -ItemType Directory -Path "$PackageDir\config" -Force
$null = New-Item -ItemType Directory -Path "$PackageDir\web" -Force

# Copy backend binary
Copy-Item $BackendBinary "$PackageDir\bin\" -Force
Write-Host "  * Backend binary copied" -ForegroundColor Green

# Copy configuration
if (Test-Path $ConfigFile) {
    Copy-Item $ConfigFile "$PackageDir\config\" -Force
}
else {
    # Create default config
    $defaultConfig = @{
        devices = @{}
    } | ConvertTo-Json
    Set-Content "$PackageDir\config\devices.json" $defaultConfig
}
Write-Host "  * Configuration file copied" -ForegroundColor Green

# Copy frontend
if (Test-Path $FrontendDir) {
    Copy-Item "$FrontendDir\*" "$PackageDir\web\" -Recurse -Force
    Write-Host "  * Frontend files copied" -ForegroundColor Green
}

# Copy scripts
Copy-Item (Join-Path $ScriptDir "INSTALL.bat") "$PackageDir\" -Force
Copy-Item (Join-Path $ScriptDir "START_SERVICE.bat") "$PackageDir\" -Force
Write-Host "  * Installer scripts copied" -ForegroundColor Green

# Copy documentation
$docFiles = @("BUILD_WINDOWS.md", "README.md", "CONTRIBUTING.md", "LICENSE.md")
foreach ($doc in $docFiles) {
    $docPath = Join-Path $ScriptDir $doc
    if (Test-Path $docPath) {
        Copy-Item $docPath "$PackageDir\" -Force
    }
}
Write-Host "  * Documentation copied" -ForegroundColor Green

# Create environment template
$envTemplate = @"
# ScaleIT Bridge Configuration
# Copy this to .env and modify values as needed

# Configuration file path
CONFIG_PATH=config/devices.json

# Logging level (trace, debug, info, warn, error)
RUST_LOG=info

# Server port
PORT=8080

# Backtrace on error (1 = full, line = limited)
RUST_BACKTRACE=1

# Number of worker threads (0 = auto-detect)
NUM_WORKERS=0
"@
Set-Content (Join-Path $PackageDir ".env.example") $envTemplate
Write-Host "  * Environment template created" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] Creating README..." -ForegroundColor Cyan

$readme = @"
# ScaleIT Bridge - Windows Package

Version: $Version

## Quick Start

### 1. Extract the Package
Extract this ZIP file to your desired location, e.g.:
``powershell
C:\Program Files\ScaleIT_Bridge
```

### 2. Install as Service
Run INSTALL.bat as Administrator to:
- Copy files to Program Files
- Create Windows service
- Configure auto-start

### 3. Configure
Edit the configuration files:
- `.env` - Application settings
- `config/devices.json` - Device definitions

### 4. Start Service
```powershell
# As Administrator:
net start "ScaleIT-Bridge"
```

### 5. Access Web Interface
Open your browser to: http://localhost:8080

## File Structure

```
├── bin/
│   └── scaleit-bridge.exe         Backend service executable
├── config/
│   └── devices.json               Device configuration
├── web/                           Frontend web interface
├── .env.example                   Environment configuration template
├── INSTALL.bat                    Windows service installer
├── START_SERVICE.bat              Manual service startup
└── README.md                      This file
```

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
net stop "ScaleIT-Bridge" ; net start "ScaleIT-Bridge"
```

### Check Status
```powershell
sc query "ScaleIT-Bridge"
```

### Uninstall Service
```powershell
net stop "ScaleIT-Bridge"
sc delete "ScaleIT-Bridge"
```

## Troubleshooting

### Service Won't Start
1. Check Windows Event Viewer for errors
2. Verify .env file has correct paths
3. Ensure port 8080 is available: `netstat -ano | findstr 8080`
4. Check file permissions on config directory

### Can't Access Web Interface
1. Verify service is running: `sc query "ScaleIT-Bridge"`
2. Check firewall allows port 8080
3. Try: http://localhost:8080 (local) or http://<your-ip>:8080 (remote)

### Configuration Issues
1. Check syntax of devices.json (valid JSON)
2. Verify file paths exist and are readable
3. Check .env for correct CONFIG_PATH

## System Requirements

- Windows 10 or later (or Windows Server 2016+)
- .NET dependencies (included with Visual C++ Redistributable)
- 100 MB disk space
- 256 MB RAM minimum

## For More Information

- Check the documentation in the extracted package
- Visit: [Project Repository]
- Review detailed build guide: BUILD_WINDOWS.md

## Support

For issues or questions:
1. Check this README
2. Review configuration files
3. Check Windows Event Viewer logs
4. Consult project documentation

---
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

Set-Content "$PackageDir\README.md" $readme
Write-Host "  ✓ README created" -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Creating distribution archive..." -ForegroundColor Cyan

$zipPath = Join-Path $OutputPath "$PackageName.zip"

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# Use built-in Compress-Archive
Compress-Archive -Path $PackageDir -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "  ✓ ZIP archive created" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Package Creation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Package Location: $zipPath" -ForegroundColor Cyan
Write-Host "Package Size: $('{0:N2}' -f ((Get-Item $zipPath).Length / 1MB)) MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Distribution Instructions:" -ForegroundColor Yellow
Write-Host "1. Send the ZIP file to the target machine"
Write-Host "2. Extract the ZIP file"
Write-Host "3. Run INSTALL.bat as Administrator"
Write-Host "4. Edit .env and config/devices.json as needed"
Write-Host "5. Start the service: net start \"ScaleIT-Bridge\""
Write-Host "6. Open http://localhost:8080 in a browser"
Write-Host ""
