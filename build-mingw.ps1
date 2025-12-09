# Build script with MinGW environment setup
# This script sets up MSYS2 MinGW environment and builds the Rust project

Write-Host "Setting up MSYS2 MinGW environment for build..." -ForegroundColor Green

# Set MinGW path
$mingwPath = "D:\msys64\mingw64"
$crossBinPath = "$mingwPath\x86_64-w64-mingw32\bin"

# Check if MSYS2 MinGW path exists
if (-not (Test-Path $mingwPath)) {
    Write-Host "Error: MSYS2 MinGW path not found: $mingwPath" -ForegroundColor Red
    Write-Host "Please ensure MSYS2 is installed with MinGW64 environment." -ForegroundColor Red
    exit 1
}

# Set environment variables
$env:PATH = "$crossBinPath;$mingwPath\bin;$env:PATH"
$env:CC = "$mingwPath\bin\gcc.exe"
$env:CXX = "$mingwPath\bin\g++.exe"
$env:AR = "$crossBinPath\ar.exe"
$env:RANLIB = "$crossBinPath\ranlib.exe"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "$mingwPath\bin\gcc.exe"

Write-Host "Environment configured:" -ForegroundColor Cyan
Write-Host "  PATH includes: $mingwPath\bin" -ForegroundColor Gray
Write-Host "  CC: $env:CC" -ForegroundColor Gray
Write-Host "  Linker: $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER" -ForegroundColor Gray

# Verify tools
Write-Host "Verifying tools..." -ForegroundColor Yellow
try {
    $gccVersion = & "$mingwPath\bin\gcc.exe" --version | Select-Object -First 1
    Write-Host "checkmark GCC: $gccVersion" -ForegroundColor Green

    $dlltoolVersion = & "$mingwPath\bin\dlltool.exe" --version | Select-Object -First 1
    Write-Host "checkmark dlltool: $dlltoolVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Failed to verify MinGW tools" -ForegroundColor Red
    exit 1
}

# Set Rust toolchain
Write-Host "Setting Rust toolchain to GNU..." -ForegroundColor Yellow
rustup default stable-x86_64-pc-windows-gnu
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Failed to set GNU toolchain" -ForegroundColor Yellow
}

# Build the project
Write-Host "Building Rust project..." -ForegroundColor Yellow
Push-Location "src-rust"

try {
    cargo build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "checkmark Build successful!" -ForegroundColor Green
    } else {
        Write-Host "x Build failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host "Build completed successfully!" -ForegroundColor Green
