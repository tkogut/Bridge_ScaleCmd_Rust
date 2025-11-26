# ScaleIT Bridge - Windows Package

Version: 1.0.0

## Quick Start

### 1. Extract the Package
Extract this ZIP file to your desired location, e.g.:
`powershell
C:\Program Files\ScaleIT_Bridge
`

### 2. Install as Service
Run INSTALL.bat as Administrator to:
- Copy files to Program Files
- Create Windows service
- Configure auto-start

### 3. Configure
Edit the configuration files:
- .env - Application settings
- config/devices.json - Device definitions

### 4. Start Service
`powershell
# As Administrator:
net start "ScaleIT-Bridge"
`

### 5. Access Web Interface
Open your browser to: http://localhost:8080

## File Structure

`
├── bin/
│   └── scaleit-bridge.exe         Backend service executable
├── config/
│   └── devices.json               Device configuration
├── web/                           Frontend web interface
├── .env.example                   Environment configuration template
├── INSTALL.bat                    Windows service installer
├── START_SERVICE.bat              Manual service startup
└── README.md                      This file
`

## Service Management

### Start Service
`powershell
net start "ScaleIT-Bridge"
`

### Stop Service
`powershell
net stop "ScaleIT-Bridge"
`

### Restart Service
`powershell
net stop "ScaleIT-Bridge" ; net start "ScaleIT-Bridge"
`

### Check Status
`powershell
sc query "ScaleIT-Bridge"
`

### Uninstall Service
`powershell
net stop "ScaleIT-Bridge"
sc delete "ScaleIT-Bridge"
`

## Troubleshooting

### Service Won't Start
1. Check Windows Event Viewer for errors
2. Verify .env file has correct paths
3. Ensure port 8080 is available: 
etstat -ano | findstr 8080
4. Check file permissions on config directory

### Can't Access Web Interface
1. Verify service is running: sc query "ScaleIT-Bridge"
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
Generated: 2025-11-26 17:23:16
