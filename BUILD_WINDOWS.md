# ScaleIT Bridge - Windows Build & Installation Guide

## Prerequisites

### Required Software
1. **Visual Studio 2022 Build Tools** (or Visual Studio Community)
   - Include "Desktop development with C++" workload
   - Download: https://visualstudio.microsoft.com/downloads/

2. **Rust** (installed via rustup)
   - Download: https://rustup.rs/
   - Should already be installed on your system

3. **Node.js** (for frontend)
   - Download: https://nodejs.org/
   - Required for building the web UI

### Installation Steps

#### 1. Install Visual Studio Build Tools (MSVC)
```powershell
# Option A: Using Chocolatey
choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" -y

# Option B: Using WinGet
winget install --id Microsoft.VisualStudio.2022.BuildTools -e

# Option C: Manual Download
# Visit https://visualstudio.microsoft.com/downloads/
# Select "Build Tools for Visual Studio 2022"
# During installation, select "Desktop development with C++"
```

#### 2. Set Up MSVC Compiler Environment
```powershell
# Run from Developer PowerShell (search for "Developer PowerShell" in Start Menu)
# OR manually source vcvarsall.bat:
"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64

# Verify link.exe is accessible
where link.exe
```

#### 3. Configure Rust for MSVC
```powershell
# Set default toolchain to MSVC
rustup default stable-x86_64-pc-windows-msvc

# Verify
rustc --version
cargo --version
```

---

## Building the Project

### Backend (Rust)

```powershell
# Navigate to backend directory
cd src-rust

# Run tests
cargo test --lib --release

# Build release binary
cargo build --release

# Output will be at: target/release/scaleit-bridge.exe
```

For automated releases that target the installer bundle, run `powershell.exe -ExecutionPolicy Bypass -File "..\build-rust-mingw.ps1"` from the repository root to configure the MinGW toolchain and produce the `x86_64-pc-windows-gnu` release binary. This script also handles the `PATH` environment, linker overrides and cleanup required for downstream packaging.

> **GNU linker path**: the scripts depend on `ld.exe` living under `D:\msys64\mingw64\x86_64-w64-mingw32\bin`. Make sure that directory is exported into `%PATH%` before the regular `mingw64\bin` so the linker is discoverable when `cargo` invokes `ld`. The scripts (`build-rust-mingw.ps1`, `build-mingw.ps1`, `test-rust-mingw.ps1`) already include that path, so rerunning them will refresh the environment.

### Frontend (React + TypeScript)

```powershell
# Install dependencies
npm install
# OR
pnpm install

# Build the frontend
npm run build
# OR
pnpm build

# Output will be at: dist/
```

---

## Creating the Installer Package

### Package Structure
```
ScaleIT_Bridge_Windows_v1.0.0/
├── bin/
│   └── scaleit-bridge.exe                 # Rust backend binary
├── config/
│   └── devices.json                       # Default configuration
├── web/
│   ├── index.html
│   ├── assets/
│   └── ... (all frontend build files)
├── .env.example                           # Environment template
├── README.md                              # Installation instructions
├── INSTALL.bat                            # Installer batch script
└── START_SERVICE.bat                      # Service startup script
```

### Building the Package

```powershell
# From repository root
$packageDir = "ScaleIT_Bridge_Windows_v1.0.0"
New-Item -ItemType Directory -Path $packageDir -Force

# Copy backend binary
Copy-Item "src-rust/target/release/scaleit-bridge.exe" "$packageDir/bin/"

# Copy configuration
Copy-Item "src-rust/config/devices.json" "$packageDir/config/"

# Copy frontend
Copy-Item "dist/*" "$packageDir/web/" -Recurse

# Copy scripts and documentation
Copy-Item "BUILD_WINDOWS.md" "$packageDir/README.md"
Copy-Item ".env.example" "$packageDir/.env.example"
```

---

## Automated Installer Packaging

Use `scripts/prepare-installer.ps1` to produce the release ZIP without manually copying files. The script:

1. Prepares the MinGW toolchain via `build-rust-mingw.ps1` and builds `src-rust` with the `x86_64-pc-windows-gnu` target.
2. Installs frontend dependencies (if missing) and runs `npm run build` to generate the `dist/` bundle.
3. Calls `Create-InstallerPackage.ps1` to copy binaries, configs, frontend assets, scripts, documentation and `.env.example` into `ScaleIT_Bridge_Windows_v<Version>` and compress it.

```powershell
# builds backend+frontend and packages everything for v1.0.0 in ./release
powershell.exe -ExecutionPolicy Bypass -File "scripts/prepare-installer.ps1" -Version "1.0.0" -OutputPath ".\release"
```

After the script finishes you can extract the generated `ScaleIT_Bridge_Windows_v1.0.0.zip` and proceed with the installation steps below.

---

## Installation on Target Machine

### Step 1: Extract Package
```powershell
Expand-Archive ScaleIT_Bridge_Windows_v1.0.0.zip -DestinationPath "C:\Program Files\ScaleIT_Bridge"
```

### Step 2: Configure Environment
```powershell
cd "C:\Program Files\ScaleIT_Bridge"

# Copy and edit environment configuration
Copy-Item ".env.example" ".env"

# Edit .env with your settings:
# - DATABASE_URL (if needed)
# - CONFIG_PATH
# - PORT
notepad .env
```

### Step 3: Register as Windows Service (Optional)
```powershell
# Run installer script
.\INSTALL.bat

# Verify service is running
Get-Service "ScaleIT-Bridge" | Format-Table -AutoSize
```

### Step 4: Access the Web Interface
```
http://localhost:8080
```

---

## Running the Service

### As Standalone Application
```powershell
cd "C:\Program Files\ScaleIT_Bridge"
.\bin\scaleit-bridge.exe
```

### As Windows Service
```powershell
# Start service
Start-Service "ScaleIT-Bridge"

# Stop service
Stop-Service "ScaleIT-Bridge"

# Check status
Get-Service "ScaleIT-Bridge"

# View logs (if configured)
Get-EventLog -LogName Application | Select-String "ScaleIT-Bridge" | Head -20
```

---

## Troubleshooting

### Issue: "link.exe not found" during cargo build
**Solution:** 
1. Install Visual Studio Build Tools with C++ option
2. Run from Developer PowerShell
3. Or manually set MSVC environment: `vcvarsall.bat x64`

### Issue: "dlltool.exe not found"
**Solution:** This indicates GNU toolchain issues. Use MSVC instead:
```powershell
rustup default stable-x86_64-pc-windows-msvc
```

### Issue: Frontend assets not loading
**Solution:** 
1. Verify `dist/` folder contains all build files
2. Check CORS headers in `main.rs`
3. Ensure web server is serving from correct path

### Issue: Configuration not persisting
**Solution:**
1. Check permissions on `config/devices.json`
2. Verify CONFIG_PATH environment variable
3. Ensure directory is writable

---

## Performance Optimization

### Release Build Flags
```toml
# In Cargo.toml [profile.release]
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

### Frontend Build Optimization
```bash
npm run build -- --minify terser --sourcemap false
```

---

## Next Steps

1. **Verify installation:**
   ```powershell
   Invoke-WebRequest http://localhost:8080/health
   ```

2. **Test device connections:**
   - Navigate to Configuration page
   - Add test device
   - Run diagnostic tests

3. **Set up monitoring:**
   - Enable logging to file
   - Configure log rotation
   - Set up alerting

---

## Support

For issues, see:
- BACKEND_GUIDELINES.md - Backend implementation details
- src/README.md - Frontend documentation
- src-rust/README.md - Rust backend documentation
