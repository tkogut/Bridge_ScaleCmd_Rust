# ScaleCmdBridge - Update Strategy

## Overview

This document describes the update/upgrade strategy for ScaleCmdBridge Windows installation. The strategy ensures that user configuration and logs are preserved during updates.

## Update Methods

### Method 1: In-Place Upgrade (Recommended)

The installer supports in-place upgrades using the same installer executable. When installing over an existing installation:

1. **Automatic Detection**: Inno Setup detects existing installation
2. **Service Stop**: Service is automatically stopped before file replacement
3. **Configuration Preservation**: Files in `ProgramData` are preserved
4. **Service Restart**: Service is automatically restarted after upgrade

#### Upgrade Process

```powershell
# 1. Download new installer
# ScaleCmdBridge-Setup-x64.exe (new version)

# 2. Run installer (as Administrator)
# The installer will:
#   - Detect existing installation
#   - Stop the service
#   - Replace files in Program Files
#   - Preserve configuration in ProgramData
#   - Restart the service

# 3. Verify upgrade
sc query ScaleCmdBridge
Invoke-WebRequest http://localhost:8080/health
```

### Method 2: Manual Upgrade Script

For advanced users or automated deployments:

```powershell
# upgrade-service.ps1
param(
    [Parameter(Mandatory=$true)]
    [string]$InstallerPath
)

# Stop service
Write-Host "Stopping service..."
net stop ScaleCmdBridge

# Backup configuration
$backupPath = "$env:ProgramData\ScaleCmdBridge\backup\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
Copy-Item "$env:ProgramData\ScaleCmdBridge\config" "$backupPath\config" -Recurse
Copy-Item "$env:ProgramData\ScaleCmdBridge\logs" "$backupPath\logs" -Recurse

# Run installer silently
Write-Host "Installing new version..."
Start-Process -FilePath $InstallerPath -ArgumentList "/SILENT", "/NORESTART" -Wait -Verb RunAs

# Start service
Write-Host "Starting service..."
net start ScaleCmdBridge

Write-Host "Upgrade complete!"
```

## Data Preservation

### Preserved During Upgrade

The following data is **automatically preserved** during upgrades:

1. **Configuration Files**
   - Location: `C:\ProgramData\ScaleCmdBridge\config\devices.json`
   - Action: Never overwritten by installer
   - Backup: Created automatically before upgrade

2. **Log Files**
   - Location: `C:\ProgramData\ScaleCmdBridge\logs\`
   - Action: Preserved, rotated logs kept
   - Cleanup: Old logs can be manually removed

3. **Service Configuration**
   - NSSM service settings (port, environment variables)
   - Firewall rules
   - Auto-start settings

### Not Preserved (Replaced)

The following are **replaced** during upgrade:

1. **Application Binary**
   - `C:\Program Files\ScaleCmdBridge\ScaleCmdBridge.exe`
   - Always replaced with new version

2. **Frontend Files**
   - `C:\Program Files\ScaleCmdBridge\web\`
   - Replaced with new frontend build

3. **Service Scripts**
   - `INSTALL-SERVICE.bat`, `UNINSTALL-SERVICE.bat`, etc.
   - Updated to match new version

## Version Management

### Version Detection

The installer checks for existing version using:

1. **Registry Key**: `HKEY_LOCAL_MACHINE\SOFTWARE\ScaleCmdBridge`
   - `DisplayVersion`: Current installed version
   - `InstallLocation`: Installation path

2. **File Version**: `ScaleCmdBridge.exe` file version

3. **Service Name**: `ScaleCmdBridge` (constant)

### Version Comparison

- **Same Version**: Installer prompts to reinstall or repair
- **Older Version**: Automatic upgrade (files replaced, config preserved)
- **Newer Version**: Installer warns about downgrade (not recommended)

## Backup Strategy

### Automatic Backup

Before any upgrade, the installer creates a backup:

```
C:\ProgramData\ScaleCmdBridge\backup\
└── YYYYMMDD_HHMMSS\
    ├── config\
    │   └── devices.json
    └── logs\
        ├── service-stdout.log
        └── service-stderr.log
```

### Manual Backup

Before major upgrades, create a manual backup:

```powershell
$backupPath = "C:\Backups\ScaleCmdBridge_$(Get-Date -Format 'yyyyMMdd')"
New-Item -ItemType Directory -Path $backupPath -Force

# Backup configuration
Copy-Item "$env:ProgramData\ScaleCmdBridge\config" "$backupPath\config" -Recurse

# Backup logs
Copy-Item "$env:ProgramData\ScaleCmdBridge\logs" "$backupPath\logs" -Recurse

# Export service configuration
$serviceConfig = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\ScaleCmdBridge" -ErrorAction SilentlyContinue
if ($serviceConfig) {
    Export-Clixml -Path "$backupPath\service-config.xml" -InputObject $serviceConfig
}
```

## Rollback Procedure

If an upgrade fails or causes issues:

### Quick Rollback

```powershell
# 1. Stop service
net stop ScaleCmdBridge

# 2. Restore from backup
$backupPath = "C:\ProgramData\ScaleCmdBridge\backup\YYYYMMDD_HHMMSS"
Copy-Item "$backupPath\config\*" "$env:ProgramData\ScaleCmdBridge\config\" -Recurse -Force

# 3. Reinstall previous version
# Run previous installer executable

# 4. Start service
net start ScaleCmdBridge
```

### Full Rollback

1. Uninstall current version
2. Restore backup configuration
3. Install previous version
4. Restore service configuration

## Configuration Migration

### Schema Changes

If the configuration schema changes between versions:

1. **Backward Compatibility**: New version should read old schema
2. **Automatic Migration**: Migrate old config to new format on first run
3. **Validation**: Validate migrated configuration

### Migration Script Example

```rust
// In DeviceManager::load_config()
fn migrate_config_if_needed(config: &mut AppConfig, version: &str) -> Result<(), BridgeError> {
    // Check version and migrate if needed
    if version < "2.0.0" {
        // Migrate old format to new format
        migrate_v1_to_v2(config)?;
    }
    Ok(())
}
```

## Silent Installation

For automated deployments:

```powershell
# Silent upgrade
.\ScaleCmdBridge-Setup-x64.exe /SILENT /NORESTART

# Silent upgrade with port
.\ScaleCmdBridge-Setup-x64.exe /SILENT /NORESTART /PORT=8080

# Silent upgrade with log file
.\ScaleCmdBridge-Setup-x64.exe /SILENT /NORESTART /LOG="C:\temp\install.log"
```

## Troubleshooting Upgrades

### Service Won't Start After Upgrade

```powershell
# Check service status
sc query ScaleCmdBridge

# Check logs
Get-Content "$env:ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 50

# Verify configuration
Test-Path "$env:ProgramData\ScaleCmdBridge\config\devices.json"

# Reinstall service
cd "C:\Program Files\ScaleCmdBridge"
.\UNINSTALL-SERVICE.bat
.\INSTALL-SERVICE.bat
```

### Configuration Lost

```powershell
# Check backup
Get-ChildItem "$env:ProgramData\ScaleCmdBridge\backup\" | Sort-Object LastWriteTime -Descending

# Restore from latest backup
$latestBackup = Get-ChildItem "$env:ProgramData\ScaleCmdBridge\backup\" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Copy-Item "$latestBackup\config\*" "$env:ProgramData\ScaleCmdBridge\config\" -Recurse -Force
```

### Port Conflict After Upgrade

```powershell
# Check if port is in use
netstat -ano | findstr :8080

# Change port in service configuration
cd "C:\Program Files\ScaleCmdBridge"
.\nssm.exe set ScaleCmdBridge AppEnvironmentExtra "PORT=8081"
net restart ScaleCmdBridge
```

## Best Practices

1. **Always Backup**: Create manual backup before major upgrades
2. **Test First**: Test upgrade on non-production system
3. **Read Release Notes**: Check for breaking changes
4. **Verify After Upgrade**: Test service and configuration
5. **Keep Backups**: Keep multiple backup versions

## Update Channels

### Stable Releases
- Full installer: `ScaleCmdBridge-Setup-x64.exe`
- Versioned: `ScaleCmdBridge-Setup-x64-v1.0.0.exe`
- Recommended for production

### Development Builds
- Nightly builds (if available)
- Not recommended for production
- May have breaking changes

## Future Enhancements

- [ ] Automatic update checker
- [ ] In-app update notification
- [ ] Delta updates (smaller download)
- [ ] Rollback from installer UI
- [ ] Configuration migration wizard

