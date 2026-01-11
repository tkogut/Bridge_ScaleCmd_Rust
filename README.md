# ScaleIT Bridge - Windows Toolchain Ready
**Universal Industrial Scale Communication Bridge**

🌉 **Bridge** connecting React/IC Canister applications with industrial scales via universal TCP/Serial communication.

---

## 🎯 Project Status

**✅ BUILD SUCCESSFUL** - Windows MinGW Toolchain Configured  
**✅ BACKEND RUNNING** - Rust server operational on port 8080  
**✅ DEVICE CONNECTIONS** - Scale adapters working with real devices  
**✅ READY FOR TESTING** - Backend and frontend integration ready  

---

## 📦 Windows Production Installation

For production deployment on Windows, use the automated installer:

### 🔨 Building the Project and Installer

**⚠️ IMPORTANT: Always use the automated build script for rebuilding!**

```powershell
# Build complete project (backend + frontend + installer) - RECOMMENDED
.\scripts\Build-WindowsInstaller.ps1

# The installer will be created in: release\ScaleCmdBridge-Setup-x64-v<VERSION>.exe
```

**Why use the build script?**
- ✅ Handles MinGW toolchain setup automatically
- ✅ Resolves AVG firewall blocking issues
- ✅ Configures environment properly
- ✅ Builds both backend (Rust) and frontend (React)
- ✅ Creates Windows installer package

**❌ DO NOT use direct `cargo build` or `cargo check`** - they will fail due to MinGW/AVG/permission issues. Always use `Build-WindowsInstaller.ps1` instead!

### Direct Download (GitHub Releases)

- Latest installer (x64): [ScaleCmdBridge-Setup-x64.exe](https://github.com/tkogut/Bridge_ScaleCmd_Rust/releases/latest/download/ScaleCmdBridge-Setup-x64.exe)

**📖 Detailed Instructions:** See [docs/INNO_SETUP_INSTALLER_GUIDE.md](docs/INNO_SETUP_INSTALLER_GUIDE.md) for complete step-by-step guide including:
- Prerequisites and requirements
- Automated build process
- Manual build process (for advanced users)
- Configuration options
- Troubleshooting
- Pre-distribution checklist

**Prerequisites:**
- Inno Setup Compiler installed (auto-detected)
- Rust backend built (release)
- React frontend built (production)
- NSSM will be downloaded automatically

### Installing ScaleCmdBridge

1. **Download** `ScaleCmdBridge-Setup-x64.exe`
2. **Run as Administrator**
3. **Follow the wizard:**
   - Select installation directory (default: `C:\Program Files\ScaleCmdBridge`)
   - Choose port (default: 8080)
   - Select optional components (desktop shortcut, etc.)
4. **Service is automatically installed and started**

### Service Management

After installation, manage the service using:

```powershell
# Start/Stop service
net start ScaleCmdBridge
net stop ScaleCmdBridge

# Or use provided scripts (in installation directory)
cd "C:\Program Files\ScaleCmdBridge"
.\START-SERVICE.bat
.\STOP-SERVICE.bat
.\INSTALL-SERVICE.bat    # Reinstall service
.\UNINSTALL-SERVICE.bat  # Remove service
```

### Configuration

- **Configuration file:** `C:\ProgramData\ScaleCmdBridge\config\devices.json`
- **Logs:** `C:\ProgramData\ScaleCmdBridge\logs\`
- **Web UI:** `http://localhost:8080` (or your configured port)

### Network Access (Local Network)

ScaleIT Bridge supports access from other computers in your local network. By default, the service runs in `lan` mode (from version 0.1.5+) which allows connections from private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x).

**To access from another computer:**

**Option 1: Direct Access**
- Open browser on client computer: `http://<MASTER_IP>:8080`
- Example: `http://192.168.1.100:8080`

**Option 2: Auto-Detection (Recommended)**
1. Open Bridge UI on client computer (can be local frontend or master server)
2. Go to **Configuration** → **Master Server Configuration**
3. Click **"Auto-Detect Master Server"**
4. Wait for detection to complete (may take a few minutes)

**Option 3: Manual Configuration**
1. Find the master server IP (run `ipconfig` on the master computer)
2. Open Bridge UI on client computer
3. Go to **Configuration** → **Master Server Configuration**
4. Enter master server IP (e.g., `192.168.1.100`) and port (`8080`)
5. Click **"Save Configuration"** and **"Test Connection"**

**Configuration Priority:**
1. Manual configuration (localStorage `MASTER_IP`)
2. Auto-detected IP (localStorage `MASTER_IP_AUTO`)
3. Current window hostname (if not localhost)
4. Fallback to localhost (`127.0.0.1:8080`)

**Network Mode Configuration:**
- **`local`**: Only localhost (127.0.0.1)
- **`lan`** (default): Local network (private IP ranges)
- **`restricted`**: Custom allowed origins (set `ALLOWED_ORIGINS` env var)

**📖 Testing Guide:** See [docs/TESTING_NETWORK_ACCESS.md](docs/TESTING_NETWORK_ACCESS.md) for step-by-step testing instructions from another computer.

See [docs/LOCAL_NETWORK_ACCESS.md](docs/LOCAL_NETWORK_ACCESS.md) for detailed configuration guide.
5. Save the configuration

**Network modes:**
- `local` - Only localhost access (most secure)
- `lan` - Local network access (default, recommended)
- `restricted` - Custom allowed origins via `ALLOWED_ORIGINS` env var

For detailed network configuration, see [docs/LOCAL_NETWORK_ACCESS.md](docs/LOCAL_NETWORK_ACCESS.md)

### Updating

Simply run the new installer over the existing installation. Configuration and logs are automatically preserved.

For detailed update procedures, see: [docs/UPDATE_STRATEGY.md](docs/UPDATE_STRATEGY.md)

---

## 🚀 Quick Start (Windows Development)

### ⚠️ IMPORTANT: Building the Project

**ALWAYS use the automated build script for complete rebuilds:**

```powershell
# Complete rebuild: backend + frontend + installer (RECOMMENDED)
.\scripts\Build-WindowsInstaller.ps1
```

**Why?** Direct `cargo build` commands will fail due to MinGW/AVG/permission issues. The build script handles everything automatically.

### Prerequisites Setup
The project now uses **MinGW/MSYS2** toolchain for Windows builds (GNU instead of MSVC):

```powershell
# 1. Ensure MSYS2 MinGW-64 is installed at: D:\msys64\mingw64
# 2. Run the setup script
powershell.exe -ExecutionPolicy Bypass -File "Setup-MinGW.ps1"
```

### Build & Run Backend (Advanced - use Build-WindowsInstaller.ps1 instead!)
```powershell
# Method 1: Direct execution in PowerShell (recommended)
.\build-rust-mingw.ps1              # Debug build (faster compilation)
.\build-rust-mingw.ps1 --release    # Release build (optimized)

# Method 2: Using powershell.exe (from CMD or anywhere)
powershell.exe -ExecutionPolicy Bypass -File "build-rust-mingw.ps1"
powershell.exe -ExecutionPolicy Bypass -File "build-rust-mingw.ps1" --release

# Run the server (from project root directory)
.\run-backend.ps1
# Or: powershell.exe -ExecutionPolicy Bypass -File "run-backend.ps1"

# Alternative: Run directly with cargo (from src-rust directory)
cd src-rust
cargo run                    # Debug build
cargo run --release          # Release build (optimized)

# Or run the compiled executable directly (from src-rust directory)
.\target\release\scaleit-bridge.exe    # Release version
.\target\debug\scaleit-bridge.exe      # Debug version

# Server available at: http://localhost:8080
```

**Important:** In PowerShell, always use `.\` prefix before script name:
- ✅ Correct: `.\build-rust-mingw.ps1 --release`
- ❌ Wrong: `build-rust-mingw.ps1 --release`

**Backend Build Script Features (`build-rust-mingw.ps1`):**
- ✅ Automatic MinGW toolchain configuration
- ✅ Cleans previous builds for fresh start
- ✅ Runs full test suite after build
- ✅ Stops interfering processes (AVG Firewall, etc.)
- ✅ Detailed error messages and troubleshooting tips
- ✅ Supports both debug and release builds

**Complete Build Script Features (`Build-WindowsInstaller.ps1`):**
- ✅ All features of `build-rust-mingw.ps1` for backend
- ✅ Automatically builds React frontend (production)
- ✅ Sets up NSSM for Windows Service
- ✅ Creates Inno Setup installer package
- ✅ Handles all environment and permission issues
- ⚠️ **Use this for complete rebuilds!**

### Quick Start Scripts (Windows Batch Files)

For convenience, use these batch files to start development:

```batch
# Start both backend and frontend servers
start-dev.bat

# Run all tests with MinGW environment
run-tests.bat
```

**Note:** These batch files automatically configure MinGW environment and start servers in separate windows.

### Run Frontend
```bash
# In a separate terminal
npm install
npm run dev
# Frontend available at: http://localhost:5173
```

### Run Tests
```powershell
# Method 1: Using batch file (easiest)
.\run-tests.bat

# Method 2: Using PowerShell script directly
.\test-rust-mingw.ps1
# Or: powershell.exe -ExecutionPolicy Bypass -File "test-rust-mingw.ps1"

# Method 3: Manual setup (requires MinGW environment)
# First setup MinGW environment:
.\Setup-MinGW.ps1
# Then run tests:
cd src-rust
cargo test
```

**Important:** Tests require MinGW environment to be configured. The `test-rust-mingw.ps1` script and `run-tests.bat` automatically configure the MinGW environment for you. If running tests manually with `cargo test`, first run `Setup-MinGW.ps1` to configure the environment.

### Package Installer
```powershell
# Build backend, frontend and create installer in one shot
powershell.exe -ExecutionPolicy Bypass -File "scripts/prepare-installer.ps1" -Version "1.0.0" -OutputPath ".\release"
```
This helper script:
1. Rebuilds the Rust backend with the MinGW toolchain (`build-rust-mingw.ps1`)
2. Compiles the React frontend (`npm run build`)
3. Executes `Create-InstallerPackage.ps1` to bundle the binaries, frontend assets, scripts and docs into `ScaleIT_Bridge_Windows_v1.0.0.zip` (or the supplied version) stored under the `OutputPath`.

If you prefer manual control, you can still run `Create-InstallerPackage.ps1` directly after you have `src-rust/target/release/scaleit-bridge.exe` and a populated `dist/` folder.

---

## 🏗️ Windows Toolchain Configuration

### MinGW/MSYS2 Setup (GNU Toolchain)
The project uses GNU toolchain instead of MSVC to avoid Visual Studio requirements:

```powershell
$env:PATH = "$mingwPath\bin;$mingwPath\x86_64-w64-mingw32\bin;$env:PATH"
$env:CC = "$mingwPath\bin\gcc.exe"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "$mingwPath\bin\gcc.exe"

_Note: If `cargo` still cannot find `ld`, ensure the path `D:\msys64\mingw64\x86_64-w64-mingw32\bin` (where the GNU linker lives) appears before `$mingwPath\bin` in your `PATH`. This directory is also referenced by `build-rust-mingw.ps1`, `build-mingw.ps1` and test scripts so they can reuse the same linker._

# Rust toolchain
rustup default stable-x86_64-pc-windows-gnu
```

### Why GNU Toolchain?
- ❌ MSVC requires Visual Studio Build Tools (large install)
- ❌ cl.exe and C/C++ build tools missing in some environments  
- ✅ MinGW provides complete GNU toolchain (gcc, dlltool, ar, ranlib)
- ✅ Works without Visual Studio dependencies
- ✅ Smaller footprint and easier CI/CD integration

---

## 📊 Current Features & Status

### Backend (Rust) - ✅ WORKING
```
✅ Actix-web server running on :8080
✅ Device manager with enum adapter wrapper
✅ Rinstrum C320 adapter connected (192.168.1.254:4001)
✅ Dini Argeo adapter (configurable, currently disabled)
✅ Health check endpoints responding
✅ Configuration loading from JSON files
✅ Graceful shutdown handling (API endpoint + Ctrl-C)
✅ Server control API: POST /api/shutdown, POST /api/start
✅ Case-insensitive command matching
✅ All tests passing 100%
```

### Frontend (React) - ✅ WORKING
```
✅ Real-time server status monitoring (Running/Stopped/Error)
✅ Device configuration management with validation
✅ Diagnostics panel with live connection status
✅ Scale operations panel for weight commands
✅ Service control (Start/Stop/Restart) with status updates
✅ Automatic status refresh every 5 seconds
✅ Error handling and user-friendly messages
```

### Device Operations
```
POST /scalecmd

Supported Commands:
✅ readGross  : Read total weight
✅ readNet    : Read net weight (minus tare)
✅ tare       : Set tare to current weight
✅ zero       : Full scale reset
```

### Active Device Connections
```
✅ c320 (Rinstrum C320): Connected at 192.168.1.254:4001
⚪ dwf (Dini Argeo): Configured but disabled
```

### Diagnostics & Monitoring
```
✅ Real-time connection status detection (Online/Offline)
✅ Device health monitoring (Responsive/Unresponsive)
✅ Server status display (Running/Stopped/Error)
✅ Automatic status refresh every 5 seconds
✅ Live diagnostics panel with actual device state
✅ Removed hardcoded status simulation
```

---

## 🔌 API Testing

### Health Check
```bash
curl http://localhost:8080/health
# Response: {"status": "OK", "service": "ScaleIT Bridge", "version": "0.1.0"}
```

### Read Weight from Scale
```bash
# Commands are case-insensitive: readGross, readgross, READGROSS all work
curl -X POST http://localhost:8080/scalecmd \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "c320",
    "command": "readGross"
  }'
```

### List Available Devices
```bash
curl http://localhost:8080/devices
# Shows configured devices and their status
```

### Shutdown Server (Graceful)
```bash
curl -X POST http://localhost:8080/api/shutdown
# Response: {"success": true, "message": "Shutdown initiated..."}
# Server will disconnect all devices and stop gracefully
```

### Device Configuration Management
```bash
# Get all device configs
curl http://localhost:8080/api/config

# Save device config
curl -X POST http://localhost:8080/api/config/save \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "new_device",
    "config": {
      "name": "New Device",
      "manufacturer": "Manufacturer",
      "model": "Model",
      "protocol": "RINCMD",
      "connection": {
        "connection_type": "Tcp",
        "host": "192.168.1.100",
        "port": 4001
      },
      "timeout_ms": 3000,
      "commands": {
        "readGross": "20050026",
        "readNet": "20050025",
        "tare": "21120008:0C",
        "zero": "21120008:0B"
      },
      "enabled": true
    }
  }'

# Delete device config
curl -X DELETE http://localhost:8080/api/config/new_device
```

---

## 🛠️ Development Environment

### Required Tools
```
✅ Rust 1.91.1 (stable-x86_64-pc-windows-gnu)
✅ MSYS2 MinGW-64 toolchain
✅ Node.js & npm (for frontend)
✅ Git for version control
```

### Build Process
```
1. Setup-MinGW.ps1      - Configure MinGW environment
2. build-rust-mingw.ps1 - Build Rust backend with proper toolchain
3. run-backend.ps1      - Start server with correct environment
4. npm run dev          - Start frontend development server
```

### Project Structure
```
Bridge_ScaleCmd_Rust/
├── src-rust/           ✅ Rust backend (Actix-web)
│   ├── src/
│   │   ├── adapters/   ✅ Device adapter implementations
│   │   ├── models/     ✅ Data structures and types
│   │   └── main.rs     ✅ Server entry point
│   ├── config/         ✅ Device configurations
│   └── Cargo.toml      ✅ Dependencies and build config
├── src/                🔄 React frontend (TypeScript/Vite)
│   ├── components/     🔄 UI components
│   ├── services/       🔄 API service layer
│   └── utils/          🔄 Utilities and helpers
├── e2e/                ⚪ Playwright end-to-end tests
└── scripts/            ✅ Build and deployment scripts
```

---

## 🧪 Testing Status

### Backend Tests
```
✅ Build successful with warnings (unused imports)
⚠️  Some test failures due to missing types (ConnectionConfig)
✅ Server starts and runs correctly
✅ Device connections working
✅ API endpoints responding
```

### Frontend Tests
```
🔄 In progress - requires backend integration
🔄 API service layer tests
🔄 Component unit tests
🔄 E2E testing with Playwright
```

### Integration Testing
```
✅ Backend-to-scale device communication
🔄 Frontend-to-backend API calls
🔄 End-to-end workflow testing
```

---

## 📋 Configuration

### Device Configuration (config/devices.json)
```json
{
  "devices": {
    "c320": {
      "name": "C320 Rinstrum",
      "manufacturer": "Rinstrum",
      "model": "C320",
      "protocol": "RINCMD",
      "connection": {
        "connection_type": "Tcp",
        "host": "192.168.1.254",
        "port": 4001,
        "timeout_ms": 3000
      },
      "enabled": true
    },
    "dwf": {
      "name": "DFW - Dini Argeo",
      "manufacturer": "Dini Argeo",
      "model": "DFW",
      "protocol": "DINI_ASCII",
      "connection": {
        "connection_type": "Serial",
        "port": "COM3",
        "baud_rate": 9600,
        "timeout_ms": 1000
      },
      "enabled": false
    }
  }
}
```

---

## 🔧 Architecture Details

### Rust Backend Architecture
```
DeviceManager
├── DeviceAdapterEnum (enum wrapper for object safety)
│   ├── RinstrumC320(RinstrumAdapter)
│   └── DiniArgeo(DiniArgeoAdapter)
├── Connection handling (TCP/Serial)
├── Command processing
└── Error handling & logging
```

### Adapter Pattern
- **DeviceAdapterEnum**: Solves `dyn DeviceAdapter` object safety issues
- **Concrete Adapters**: RinstrumAdapter, DiniArgeoAdapter
- **Connection Types**: TCP sockets, Serial ports
- **Command Mapping**: Device-specific protocol commands

---

## 🚀 Performance Metrics

### Current Performance
```
✅ Server startup time: <2 seconds
✅ Response time: <50ms for health checks
✅ Memory usage: ~15MB base + dependencies
✅ Build time: ~2 minutes (first build)
✅ Scale connection: <1 second (TCP)
```

### Resource Usage
```
Backend (Rust):    ~25MB RAM, <1% CPU idle
Frontend (Vite):   Development server ~50MB RAM
Build artifacts:   ~15MB total size
```

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Build Fails with "dlltool not found"
```powershell
# Ensure MSYS2 MinGW-64 is installed and PATH is set
$env:PATH = "D:\msys64\mingw64\bin;D:\msys64\mingw64\x86_64-w64-mingw32\bin;$env:PATH"
```

#### Rust toolchain errors
```bash
# Reinstall GNU toolchain
rustup toolchain uninstall stable-x86_64-pc-windows-gnu
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup default stable-x86_64-pc-windows-gnu
```

#### Permission denied during build
```powershell
# Clean build artifacts
cargo clean
# Or delete target directory manually
Remove-Item -Recurse -Force .\src-rust\target
```

#### Scale device not connecting
- Check IP address and port in `config/devices.json`
- Verify network connectivity to scale device
- Ensure scale is powered on and responsive

---

## 📖 Documentation

- **[API Documentation (Swagger/OpenAPI)](swagger.yaml)** - Complete API specification
- **[Swagger Usage Guide](docs/SWAGGER_API_DOCUMENTATION.md)** - How to view and use API documentation
- **[Caffeine.ai Integration Guide](CAFFEINE_AI_INTEGRATION_GUIDE.md)** - Integration guide for Motoko/Internet Computer
- **[Windows Installation Guide](docs/WINDOWS_INSTALLATION_GUIDE.md)** - Complete Windows setup
- **[Build Process](BUILD_WINDOWS.md)** - Detailed build instructions  
- **[Testing Guide](TESTING_AND_DEPLOYMENT.md)** - Testing procedures
- **[Device Configuration](src-rust/config/)** - Scale setup examples

---

## 🔄 Next Steps

### Immediate Tasks
1. **Frontend Integration** - Connect React app to Rust backend
2. **API Testing** - Comprehensive endpoint testing
3. **Error Handling** - Improve error messages and recovery
4. **Configuration UI** - Web interface for device setup

### Short Term
1. **Additional Adapters** - More scale manufacturer support
2. **Serial Port Testing** - COM port device connections
3. **Production Packaging** - Windows installer creation
4. **Performance Optimization** - Response time improvements

### Long Term
1. **Multi-scale Support** - Handle multiple concurrent devices
2. **Real-time Updates** - WebSocket for live weight readings
3. **Historical Data** - Weight logging and analytics
4. **Cloud Integration** - Remote monitoring capabilities

---

## 🤝 Contributing

### Development Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd Bridge_ScaleCmd_Rust

# 2. Setup Windows toolchain
powershell.exe -ExecutionPolicy Bypass -File "Setup-MinGW.ps1"

# 3. Build backend
powershell.exe -ExecutionPolicy Bypass -File "build-rust-mingw.ps1"

# 4. Install frontend dependencies
npm install

# 5. Run in development mode
# Terminal 1: Backend
powershell.exe -ExecutionPolicy Bypass -File "run-backend.ps1"
# Terminal 2: Frontend  
npm run dev
```

### Code Standards
- **Rust**: Use `cargo fmt` and `cargo clippy`
- **TypeScript**: Follow ESLint configuration
- **Tests**: Write unit tests for new features
- **Documentation**: Update README for significant changes

---

## 📄 License

MIT License - see [LICENSE.md](LICENSE.md) for details.

---

## 📞 Support & Contact

- **Issues**: GitHub Issues tracker
- **Discussions**: GitHub Discussions
- **Documentation**: See `docs/` directory
- **Build Status**: Check GitHub Actions

---

## 🎯 Project Summary

**ScaleIT Bridge** successfully bridges the gap between modern web applications and industrial scale hardware. The Windows MinGW toolchain solution provides a robust, dependency-light build environment that works without Visual Studio requirements.

**Key Achievements:**
- ✅ Windows build environment working with GNU toolchain
- ✅ Rust backend server operational and tested
- ✅ Real device connections established and verified
- ✅ API endpoints functional and responsive
- ✅ Architecture scalable for multiple device types
- ✅ Ready for production deployment and frontend integration

---

**Status: Ready for Integration Testing** 🚀  
🛡️ If `ld` or `dlltool` keep failing with “Permission denied”, stop the AVG Firewall service before running `build-rust-mingw.ps1`/`test-rust-mingw.ps1`:
```powershell
Stop-AvgFirewall
```
**Last Updated:** November 30, 2025  
**Build Status:** ✅ Passing  
**Server Status:** ✅ Running on :8080