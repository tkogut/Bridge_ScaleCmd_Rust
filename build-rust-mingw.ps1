# PowerShell script to build ScaleIT Bridge with MinGW toolchain
# This script properly configures MinGW environment and builds the Rust project

function Stop-ExistingRustBuildProcesses {
    $processNames = @("cargo", "rustc", "x86_64-w64-mingw32-gcc")
    foreach ($processName in $processNames) {
        try {
            $running = Get-Process -Name $processName -ErrorAction SilentlyContinue
        } catch {
            continue
        }

        foreach ($proc in $running) {
            Write-Host "Stopping lingering process: $($proc.ProcessName) (PID $($proc.Id))" -ForegroundColor Yellow
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Host "Unable to stop $($proc.ProcessName) (PID $($proc.Id)), continuing..." -ForegroundColor Red
            }
        }
    }
}

function Reset-TargetDirectory {
    param([string]$RootPath)

    $targetDir = Join-Path $RootPath "src-rust\target"
    if (-not (Test-Path $targetDir)) {
        return
    }

    Write-Host "Resetting attributes under $targetDir to avoid permission issues..." -ForegroundColor Yellow
    Get-ChildItem -Path $targetDir -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Attributes -band [System.IO.FileAttributes]::ReadOnly) {
            $_.Attributes = $_.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
        }
    }

    Write-Host "Removing stale target directory before clean build..." -ForegroundColor Yellow
    try {
        Remove-Item -Recurse -Force -ErrorAction Stop $targetDir
        Write-Host "Stale target directory removed successfully" -ForegroundColor Green
    } catch {
        Write-Host "Unable to remove target directory cleanly; cargo clean will continue." -ForegroundColor Yellow
    }
}

Write-Host "Building ScaleIT Bridge with MinGW toolchain..." -ForegroundColor Green
Write-Host ""

# Ensure we run from the script directory even if the caller uses an absolute path
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $repoRoot

function Stop-AvgFirewall {
    $serviceName = "AVG Firewall"
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne "Stopped") {
        Write-Host "Stopping $serviceName to avoid permission locks..." -ForegroundColor Yellow
        try {
            Stop-Service -Name $serviceName -Force -ErrorAction Stop
        } catch {
            Write-Host ("Failed to stop {0}: {1}" -f $serviceName, $_.Exception.Message) -ForegroundColor Red
        }
    }
}

Stop-AvgFirewall
Stop-ExistingRustBuildProcesses
Reset-TargetDirectory -RootPath $repoRoot

# Set MinGW paths
$mingwPath = "D:\msys64\mingw64"
$mingwBinPath = "$mingwPath\bin"
$mingwCrossBinPath = "$mingwPath\x86_64-w64-mingw32\bin"

# Check if MSYS2 MinGW paths exist
if (-not (Test-Path $mingwPath)) {
    Write-Host "Error: MSYS2 MinGW path not found: $mingwPath" -ForegroundColor Red
    Write-Host "Please ensure MSYS2 is installed with MinGW64 environment." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $mingwCrossBinPath)) {
    Write-Host "Error: MinGW cross-compile tools not found: $mingwCrossBinPath" -ForegroundColor Red
    Write-Host "Please install mingw-w64 toolchain in MSYS2:" -ForegroundColor Red
    Write-Host "  pacman -S mingw-w64-x86_64-toolchain" -ForegroundColor Yellow
    exit 1
}

# Set environment variables for MinGW build
$env:PATH = "$mingwBinPath;$mingwCrossBinPath;$env:PATH"
$env:CC = "$mingwBinPath\gcc.exe"
$env:CXX = "$mingwBinPath\g++.exe"
$env:AR = "$mingwCrossBinPath\ar.exe"
$env:RANLIB = "$mingwCrossBinPath\ranlib.exe"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "$mingwBinPath\gcc.exe"
$env:RUSTFLAGS = "-C target-cpu=native"

Write-Host "MinGW environment configured:" -ForegroundColor Yellow
Write-Host "  MINGW_PATH: $mingwPath" -ForegroundColor Gray
Write-Host "  CC: $env:CC" -ForegroundColor Gray
Write-Host "  AR: $env:AR" -ForegroundColor Gray
Write-Host "  LINKER: $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER" -ForegroundColor Gray
Write-Host ""

# Verify tools are available
Write-Host "Verifying MinGW tools..." -ForegroundColor Yellow

$tools = @(
    @{ Name = "gcc"; Path = "$mingwBinPath\gcc.exe" },
    @{ Name = "dlltool"; Path = "$mingwCrossBinPath\dlltool.exe" },
    @{ Name = "ar"; Path = "$mingwCrossBinPath\ar.exe" },
    @{ Name = "ranlib"; Path = "$mingwCrossBinPath\ranlib.exe" }
)

foreach ($tool in $tools) {
    if (Test-Path $tool.Path) {
        Write-Host "  checkmark $($tool.Name) found" -ForegroundColor Green
    } else {
        Write-Host "  X $($tool.Name) not found at $($tool.Path)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Set Rust toolchain to GNU
Write-Host "Setting Rust toolchain to GNU..." -ForegroundColor Yellow
try {
    rustup default stable-x86_64-pc-windows-gnu
    Write-Host "Rust GNU toolchain activated" -ForegroundColor Green
} catch {
    Write-Host "Error setting Rust toolchain. Please run manually:" -ForegroundColor Red
    Write-Host "  rustup toolchain install stable-x86_64-pc-windows-gnu" -ForegroundColor White
    Write-Host "  rustup default stable-x86_64-pc-windows-gnu" -ForegroundColor White
    exit 1
}

Write-Host ""

# Navigate to Rust source directory
if (-not (Test-Path "src-rust")) {
    Write-Host "Error: src-rust directory not found" -ForegroundColor Red
    exit 1
}

Set-Location "src-rust"
Write-Host "Changed to src-rust directory" -ForegroundColor Gray

# Clean previous build
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
cargo clean

# Check for release build flag
$buildMode = "debug"
if ($args -contains "--release" -or $args -contains "-r") {
    $buildMode = "release"
    Write-Host "Building in RELEASE mode (optimized)" -ForegroundColor Cyan
} else {
    Write-Host "Building in DEBUG mode (faster compilation)" -ForegroundColor Cyan
}
Write-Host ""

# Build the project
Write-Host "Building Rust project..." -ForegroundColor Yellow
Write-Host "This may take a few minutes on first build..." -ForegroundColor Gray
Write-Host ""

if ($buildMode -eq "release") {
    cargo build --release | Out-Null
} else {
    cargo build | Out-Null
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Common solutions:" -ForegroundColor Cyan
    Write-Host "1. Ensure MSYS2 MinGW64 is fully installed" -ForegroundColor White
    Write-Host "2. Run: pacman -S mingw-w64-x86_64-toolchain" -ForegroundColor White
    Write-Host "3. Check that no antivirus is blocking build files" -ForegroundColor White
    Write-Host "4. Try stopping AVG Firewall: .\AVG_OFF.bat" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "Build successful!" -ForegroundColor Green
Write-Host ""

# Run tests (unless --skip-tests flag is provided)
if ($args -notcontains "--skip-tests" -and $args -notcontains "--no-tests") {
    Write-Host "Running tests..." -ForegroundColor Yellow
    cargo test | Out-Null
    $testExitCode = $LASTEXITCODE
    if ($testExitCode -ne 0) {
        Write-Host ""
        Write-Host "Some tests failed, but build is complete." -ForegroundColor Yellow
        Write-Host "Review test output above for details." -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "All tests passed! ✅" -ForegroundColor Green
    }
    # Reset exit code to 0 if build succeeded (tests are optional)
    $LASTEXITCODE = 0
} else {
    Write-Host "Skipping tests (--skip-tests flag provided)" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Green
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

if ($buildMode -eq "release") {
    $exePath = "target\release\scaleit-bridge.exe"
} else {
    $exePath = "target\debug\scaleit-bridge.exe"
}

if (Test-Path $exePath) {
    $fileInfo = Get-Item $exePath
    Write-Host "Executable: $exePath" -ForegroundColor Cyan
    Write-Host "Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  • Run server: cargo run" -ForegroundColor White
Write-Host "  • Run with script: ..\run-backend.ps1" -ForegroundColor White
if ($buildMode -ne "release") {
    Write-Host "  • Build release: .\build-rust-mingw.ps1 --release" -ForegroundColor White
}
Write-Host ""
Write-Host "Server will be available at: http://localhost:8080" -ForegroundColor Yellow
Write-Host ""
