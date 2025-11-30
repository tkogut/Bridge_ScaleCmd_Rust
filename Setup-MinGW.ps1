# Setup MinGW toolchain for Rust compilation on Windows
# This script configures the environment to use MinGW instead of MSVC

Write-Host "Setting up MinGW toolchain for Rust..." -ForegroundColor Green

# Set MinGW path - using MSYS2 mingw64 environment
$mingwPath = "D:\msys64\mingw64"

# Check if MSYS2 MinGW path exists
if (-not (Test-Path $mingwPath)) {
    Write-Host "Error: MSYS2 MinGW path not found: $mingwPath" -ForegroundColor Red
    Write-Host "Please ensure MSYS2 is installed with MinGW64 environment." -ForegroundColor Red
    Write-Host "You can install MSYS2 from https://www.msys2.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Set environment variables for MSYS2 MinGW64
$env:PATH = "$mingwPath\bin;$env:PATH"
$env:RUSTFLAGS = "-C target-cpu=native"
$env:CC = "$mingwPath\bin\gcc.exe"
$env:CXX = "$mingwPath\bin\g++.exe"
$env:AR = "$mingwPath\bin\ar.exe"
$env:RANLIB = "$mingwPath\bin\ranlib.exe"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "$mingwPath\bin\gcc.exe"

Write-Host "MSYS2 MinGW toolchain configured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Environment variables set:" -ForegroundColor Cyan
Write-Host "  MINGW_PATH=$mingwPath"
Write-Host "  CC=$env:CC"
Write-Host "  CXX=$env:CXX"
Write-Host "  AR=$env:AR"
Write-Host "  RANLIB=$env:RANLIB"
Write-Host "  CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER"
Write-Host ""

Write-Host "Verifying MSYS2 MinGW installation..." -ForegroundColor Yellow

# Verify tools are available
Write-Host "Checking gcc..." -ForegroundColor Cyan
try {
    & "$mingwPath\bin\gcc.exe" --version
    if ($LASTEXITCODE -ne 0) { throw "gcc failed" }
} catch {
    Write-Host "Error: gcc not found or not working" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Checking dlltool..." -ForegroundColor Cyan
try {
    & "$mingwPath\bin\dlltool.exe" --version
    if ($LASTEXITCODE -ne 0) { throw "dlltool failed" }
} catch {
    Write-Host "Error: dlltool not found or not working" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Checking ar..." -ForegroundColor Cyan
try {
    & "$mingwPath\bin\ar.exe" --version
    if ($LASTEXITCODE -ne 0) { throw "ar failed" }
} catch {
    Write-Host "Error: ar not found or not working" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "All MSYS2 MinGW tools verified successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "Setting Rust toolchain to GNU..." -ForegroundColor Yellow
try {
    rustup toolchain install stable-x86_64-pc-windows-gnu
    rustup default stable-x86_64-pc-windows-gnu
    Write-Host "Rust toolchain set to GNU successfully!" -ForegroundColor Green
} catch {
    Write-Host "Warning: Failed to set Rust toolchain. You may need to run this manually:" -ForegroundColor Yellow
    Write-Host "  rustup toolchain install stable-x86_64-pc-windows-gnu" -ForegroundColor White
    Write-Host "  rustup default stable-x86_64-pc-windows-gnu" -ForegroundColor White
}

Write-Host ""
Write-Host "MinGW setup complete! You can now build the Rust project." -ForegroundColor Green
Write-Host "Run: cargo build --release" -ForegroundColor Cyan
Write-Host ""

# Set persistent environment variables for the current session
[Environment]::SetEnvironmentVariable("MINGW_PATH", $mingwPath, "Process")
[Environment]::SetEnvironmentVariable("CC", "$mingwPath\bin\gcc.exe", "Process")
[Environment]::SetEnvironmentVariable("CXX", "$mingwPath\bin\g++.exe", "Process")
[Environment]::SetEnvironmentVariable("AR", "$mingwPath\bin\ar.exe", "Process")
[Environment]::SetEnvironmentVariable("RANLIB", "$mingwPath\bin\ranlib.exe", "Process")
[Environment]::SetEnvironmentVariable("CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER", "$mingwPath\bin\gcc.exe", "Process")

Write-Host "Environment variables have been set for this session." -ForegroundColor Green
Write-Host "To make them permanent, add them to your system environment variables." -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: This script uses your MSYS2 installation at D:\msys64" -ForegroundColor Cyan
Write-Host "If you need to update the path, modify the mingwPath variable in this script." -ForegroundColor Cyan
