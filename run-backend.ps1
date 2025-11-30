# Simple PowerShell script to run ScaleIT Bridge backend with MinGW
# This script sets up the environment and runs the Rust server

Write-Host "Starting ScaleIT Bridge Backend..." -ForegroundColor Green
Write-Host ""

# Set MinGW environment
$mingwPath = "D:\msys64\mingw64"
$env:PATH = "$mingwPath\bin;$mingwPath\x86_64-w64-mingw32\bin;$env:PATH"
$env:CC = "$mingwPath\bin\gcc.exe"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "$mingwPath\bin\gcc.exe"

Write-Host "MinGW environment configured" -ForegroundColor Yellow
Write-Host "Starting server at http://localhost:8080" -ForegroundColor Cyan
Write-Host ""

# Set Rust toolchain
rustup default stable-x86_64-pc-windows-gnu

# Navigate to src-rust directory
Push-Location "src-rust"

try {
    # Run the server
    cargo run
} finally {
    # Always return to original directory
    Pop-Location
}
