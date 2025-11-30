# PowerShell script to start the ScaleIT Bridge backend server
# This script sets up the MinGW environment and runs the Rust server

Write-Host "Starting ScaleIT Bridge Backend Server..." -ForegroundColor Green
Write-Host ""

# Set MinGW environment variables
$mingwPath = "D:\msys64\mingw64"
$env:PATH = "$mingwPath\bin;$env:PATH"
$env:CC = "$mingwPath\bin\gcc.exe"
$env:CXX = "$mingwPath\bin\g++.exe"
$env:AR = "$mingwPath\bin\ar.exe"
$env:RANLIB = "$mingwPath\bin\ranlib.exe"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "$mingwPath\bin\gcc.exe"

Write-Host "MinGW environment configured" -ForegroundColor Yellow
Write-Host "PATH includes: $mingwPath\bin" -ForegroundColor Gray

# Set Rust toolchain
Write-Host "Setting Rust toolchain to GNU..." -ForegroundColor Yellow
rustup default stable-x86_64-pc-windows-gnu

# Navigate to src-rust directory
Set-Location "src-rust"

Write-Host ""
Write-Host "Building and starting server..." -ForegroundColor Yellow
Write-Host "This will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""

# Run the server
try {
    cargo run
} catch {
    Write-Host "Error starting server: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
