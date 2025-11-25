# Windows Installation Package - Summary

## What Has Been Prepared

Complete Windows installation and deployment infrastructure for ScaleIT Bridge has been created.

### 📦 Package Components

#### Scripts for Building (from Source)
1. **`CHECK-Prerequisites.ps1`** - Verifies all required software
   - Checks Rust, MSVC compiler, Node.js
   - Validates project structure
   - Reports missing components

2. **`BUILD.bat`** - Compiles the entire project
   - Backend (Rust): 5-10 minutes
   - Frontend (React): 2-3 minutes
   - Creates optimized release binaries

3. **`Create-InstallerPackage.ps1`** - Creates distributable ZIP
   - Packages binaries, config, and web files
   - Creates README and documentation
   - Generates installation scripts

#### Scripts for Deployment
4. **`INSTALL.bat`** - Automated Windows service setup
   - Copies files to Program Files
   - Creates "ScaleIT-Bridge" Windows service
   - Configures auto-start
   - Sets up recovery policy

5. **`START_SERVICE.bat`** - Manual service startup
   - Starts the Windows service
   - Verifies service is running
   - Shows status information

#### Documentation
6. **`BUILD_WINDOWS.md`** - Build instructions
   - Prerequisites and installation
   - Step-by-step build process
   - Troubleshooting guide

7. **`WINDOWS_INSTALLATION_GUIDE.md`** - Complete installation guide
   - System requirements
   - Detailed setup instructions
   - Configuration reference
   - Service management commands
   - Troubleshooting procedures
   - Performance tuning tips

---

## Quick Start Guide

### For Developers (Build from Source)

```powershell
# 1. Check prerequisites
.\Check-Prerequisites.ps1

# 2. Build the project (run from Developer PowerShell)
.\BUILD.bat

# 3. Create installer package
.\Create-InstallerPackage.ps1 -Version "1.0.0"
```

**Output**: `ScaleIT_Bridge_Windows_v1.0.0.zip`

### For System Administrators (Deploy)

```powershell
# 1. Extract package
Expand-Archive "ScaleIT_Bridge_Windows_v1.0.0.zip" -DestinationPath "C:\temp"

# 2. Run installer (as Administrator)
cd "C:\temp\ScaleIT_Bridge_Windows_v1.0.0"
.\INSTALL.bat

# 3. Configure (edit these files)
notepad "C:\Program Files\ScaleIT_Bridge\.env"
notepad "C:\Program Files\ScaleIT_Bridge\config\devices.json"

# 4. Start service
net start "ScaleIT-Bridge"

# 5. Access web interface
Start-Process "http://localhost:8080"
```

---

## File Structure in Installation Package

```
ScaleIT_Bridge_Windows_v1.0.0/
├── bin/
│   └── scaleit-bridge.exe              ← Main service executable
├── config/
│   └── devices.json                    ← Device configuration
├── web/                                ← Web UI files
│   ├── index.html
│   ├── assets/
│   └── ...
├── .env.example                        ← Configuration template
├── INSTALL.bat                         ← Installer script
├── START_SERVICE.bat                   ← Startup script
└── README.md                           ← Quick start
```

---

## System Requirements

- **OS**: Windows 10 / Windows 11 / Windows Server 2016+
- **Disk**: 500 MB - 1 GB
- **RAM**: 256 MB - 1 GB
- **Port**: TCP 8080 (configurable)

---

## Prerequisites for Building

Only needed if building from source:

- **Visual Studio Build Tools 2022** with C++ option (required)
- **Rust toolchain** (rustup) - already installed
- **Node.js & npm** (for frontend) - already installed

---

## Service Management

After installation, manage the service with standard Windows commands:

```powershell
# Start
net start "ScaleIT-Bridge"

# Stop
net stop "ScaleIT-Bridge"

# Restart
net stop "ScaleIT-Bridge" ; net start "ScaleIT-Bridge"

# Check status
sc query "ScaleIT-Bridge"

# Uninstall (if needed)
net stop "ScaleIT-Bridge"
sc delete "ScaleIT-Bridge"
```

---

## Next Steps

1. **Review Prerequisites**: Run `Check-Prerequisites.ps1`
2. **Build** (if from source): Run `BUILD.bat` from Developer PowerShell
3. **Create Package**: Run `Create-InstallerPackage.ps1`
4. **Distribute**: Send `.zip` file to target machines
5. **Deploy**: Run `INSTALL.bat` as Administrator
6. **Configure**: Edit `.env` and `config/devices.json`
7. **Start**: Run `net start "ScaleIT-Bridge"`
8. **Access**: Open `http://localhost:8080` in browser

---

## Troubleshooting

### Build Issues
- See: `BUILD_WINDOWS.md`
- Check: `Check-Prerequisites.ps1`
- Run from: Developer PowerShell for Visual Studio

### Deployment Issues
- See: `WINDOWS_INSTALLATION_GUIDE.md`
- Service logs: Event Viewer → Application
- Configuration: `.env` and `devices.json`

### Runtime Issues
- Check service status: `sc query "ScaleIT-Bridge"`
- Test connectivity: `Invoke-WebRequest "http://localhost:8080/health"`
- View logs: Event Viewer (Application log)

---

## Key Features

✅ Automated Windows service installation
✅ Auto-start on system boot
✅ Automatic restart on failure
✅ Web-based configuration interface
✅ Dynamic device management (no restart required)
✅ TCP and Serial device support
✅ Hot-reload configuration
✅ Comprehensive error handling
✅ Production-ready logging
✅ Full documentation

---

## Support Files

All documentation is included in the package:
- **README.md** - Quick start (in package)
- **BUILD_WINDOWS.md** - Build guide (root of repo)
- **WINDOWS_INSTALLATION_GUIDE.md** - Complete guide (root of repo)
- **BACKEND_GUIDELINES.md** - API reference (src-rust/)
- **CONTRIBUTING.md** - Development guidelines

---

**Created**: November 25, 2025
**Version**: 1.0.0
**Status**: Ready for deployment
