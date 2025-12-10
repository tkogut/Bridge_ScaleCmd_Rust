# Simple test script with MinGW environment setup
# This script sets up MSYS2 MinGW environment and runs Rust tests

Write-Host "Setting up MSYS2 MinGW environment for testing..." -ForegroundColor Green

# Set MinGW path
$mingwPath = "D:\msys64\mingw64"

function Stop-AvgFirewall {
    $serviceName = "AVG Firewall"
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne "Stopped") {
        Write-Host "Stopping $serviceName to avoid permission issues..." -ForegroundColor Yellow
        try {
            Stop-Service -Name $serviceName -Force -ErrorAction Stop
        } catch {
            Write-Host ("Unable to stop {0}: {1}" -f $serviceName, $_.Exception.Message) -ForegroundColor Red
        }
    }
}

# stop avg to avoid locking build artifacts
Stop-AvgFirewall
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

Write-Host "Environment configured successfully!" -ForegroundColor Green
Write-Host "PATH includes: $mingwPath\bin" -ForegroundColor Gray
Write-Host "CC: $env:CC" -ForegroundColor Gray
Write-Host "Linker: $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER" -ForegroundColor Gray

# Set Rust toolchain
Write-Host "Setting Rust toolchain to GNU..." -ForegroundColor Yellow
rustup default stable-x86_64-pc-windows-gnu
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Failed to set GNU toolchain" -ForegroundColor Yellow
}

# Navigate to Rust directory
Write-Host "Navigating to Rust project..." -ForegroundColor Yellow
Push-Location "src-rust"

# Run tests
Write-Host "Running Rust library tests..." -ForegroundColor Yellow
cargo test --lib
$libTestResult = $LASTEXITCODE

Write-Host ""
if ($libTestResult -eq 0) {
    Write-Host "Library tests PASSED!" -ForegroundColor Green
} else {
    Write-Host "Library tests FAILED!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Running unit tests..." -ForegroundColor Yellow
cargo test --test minimal_tests
$minimalTestResult = $LASTEXITCODE

Write-Host ""
if ($minimalTestResult -eq 0) {
    Write-Host "Minimal tests PASSED!" -ForegroundColor Green
} else {
    Write-Host "Minimal tests FAILED!" -ForegroundColor Red
}

# Return to root directory
Pop-Location

Write-Host ""
Write-Host "Test Summary:" -ForegroundColor Cyan
if ($libTestResult -eq 0) {
    Write-Host "  Library Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "  Library Tests: FAILED" -ForegroundColor Red
}

if ($minimalTestResult -eq 0) {
    Write-Host "  Minimal Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "  Minimal Tests: FAILED" -ForegroundColor Red
}

$totalFailures = 0
if ($libTestResult -ne 0) { $totalFailures++ }
if ($minimalTestResult -ne 0) { $totalFailures++ }

Write-Host ""
if ($totalFailures -eq 0) {
    Write-Host "ALL RUST TESTS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Total failures: $totalFailures" -ForegroundColor Red
    exit 1
}
