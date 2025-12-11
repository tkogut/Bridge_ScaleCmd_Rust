# ScaleCmdBridge Installer

This directory contains files for building the Windows installer.

## Files

- `ScaleCmdBridge.iss` - Inno Setup script for creating the installer
- `nssm/` - Directory for NSSM executable (download separately)

## Prerequisites

1. **Inno Setup** must be installed
   - Download from: https://jrsoftware.org/isdl.php
   - Install Inno Setup Compiler

2. **NSSM** (Non-Sucking Service Manager)
   - Download from: https://nssm.cc/download
   - Extract `nssm.exe` (64-bit version) to `installer/nssm/nssm.exe`

## Building the Installer

1. Build the Rust backend:
   ```powershell
   .\build-rust-mingw.ps1 --release
   ```

2. Build the frontend:
   ```powershell
   npm run build
   ```

3. Ensure NSSM is in `installer/nssm/nssm.exe`

4. Compile the installer:
   - Open `installer/ScaleCmdBridge.iss` in Inno Setup Compiler
   - Click "Build" → "Compile"
   - Or use command line:
     ```powershell
     "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\ScaleCmdBridge.iss
     ```

5. The installer will be created in `release/ScaleCmdBridge-Setup-x64.exe`

## Installer Features

- Port selection during installation (default: 8080)
- Automatic Windows Service installation
- Firewall configuration
- Start Menu shortcuts
- Desktop shortcut (optional)
- Automatic service startup

## Service Management

After installation, use the provided batch files:
- `INSTALL-SERVICE.bat` - Install service (run as Administrator)
- `UNINSTALL-SERVICE.bat` - Remove service (run as Administrator)
- `START-SERVICE.bat` - Start service
- `STOP-SERVICE.bat` - Stop service

Or use Windows commands:
```powershell
net start ScaleCmdBridge
net stop ScaleCmdBridge
sc query ScaleCmdBridge
```

