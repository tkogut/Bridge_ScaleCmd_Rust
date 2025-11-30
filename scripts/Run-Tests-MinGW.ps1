# Test runner script with MinGW toolchain setup for Windows
# This script sets up MinGW environment and runs all tests

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "ScaleIT Bridge Test Suite with MinGW" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

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

# Setup MSYS2 MinGW environment
Write-Host "Setting up MSYS2 MinGW toolchain..." -ForegroundColor Yellow
$env:PATH = "$mingwPath\bin;$env:PATH"
$env:RUSTFLAGS = "-C target-cpu=native"
$env:CC = "$mingwPath\bin\gcc.exe"
$env:CXX = "$mingwPath\bin\g++.exe"
$env:AR = "$mingwPath\bin\ar.exe"
$env:RANLIB = "$mingwPath\bin\ranlib.exe"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "$mingwPath\bin\gcc.exe"

# Verify MSYS2 MinGW tools
Write-Host "Verifying MSYS2 MinGW installation..." -ForegroundColor Yellow
try {
    & "$mingwPath\bin\gcc.exe" --version | Out-Null
    & "$mingwPath\bin\dlltool.exe" --version | Out-Null
    Write-Host "MSYS2 MinGW toolchain verified successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error: MSYS2 MinGW tools not working properly" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Set Rust toolchain to GNU
Write-Host "Setting Rust toolchain to GNU..." -ForegroundColor Yellow
try {
    rustup toolchain install stable-x86_64-pc-windows-gnu
    rustup default stable-x86_64-pc-windows-gnu
    Write-Host "Rust toolchain configured successfully!" -ForegroundColor Green
} catch {
    Write-Host "Warning: Failed to configure Rust toolchain" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Current Rust toolchain:" -ForegroundColor Cyan
rustup show

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Rust Backend Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Navigate to Rust directory
Push-Location "src-rust"

Write-Host ""
Write-Host "Building Rust project..." -ForegroundColor Yellow
cargo build
$buildResult = $LASTEXITCODE

if ($buildResult -ne 0) {
    Write-Host "Error: Rust build failed" -ForegroundColor Red
    Pop-Location
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Running Rust unit tests..." -ForegroundColor Yellow
cargo test --lib
$rustUnitResult = $LASTEXITCODE

Write-Host ""
Write-Host "Running Rust integration tests..." -ForegroundColor Yellow
cargo test --test integration_test
$rustIntegrationResult = $LASTEXITCODE

Write-Host ""
Write-Host "Running device adapter tests..." -ForegroundColor Yellow
cargo test device_test
$rustDeviceResult = $LASTEXITCODE

Write-Host ""
Write-Host "Running API tests..." -ForegroundColor Yellow
cargo test api_test
$rustApiResult = $LASTEXITCODE

# Return to root directory
Pop-Location

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running Frontend Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
npm install
$npmInstallResult = $LASTEXITCODE

if ($npmInstallResult -ne 0) {
    Write-Host "Error: npm install failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Running frontend unit tests..." -ForegroundColor Yellow
npm run test:unit
$frontendUnitResult = $LASTEXITCODE

Write-Host ""
Write-Host "Running frontend component tests..." -ForegroundColor Yellow
npm run test:component
$frontendComponentResult = $LASTEXITCODE

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Running End-to-End Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Installing Playwright browsers..." -ForegroundColor Yellow
npx playwright install --with-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Playwright install failed, E2E tests may not work" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting backend server for E2E tests..." -ForegroundColor Yellow
$serverJob = Start-Job -ScriptBlock {
    Set-Location "src-rust"
    cargo run --release
}

# Wait for server to start
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "Running E2E tests..." -ForegroundColor Yellow
npm run test:e2e
$e2eResult = $LASTEXITCODE

# Stop the backend server
Stop-Job $serverJob -Force
Remove-Job $serverJob -Force

# Also kill any remaining processes
Get-Process -Name "bridge_scalecmd_rust" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Display results
if ($rustUnitResult -eq 0) {
    Write-Host "checkmark Rust Unit Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "x Rust Unit Tests: FAILED" -ForegroundColor Red
}

if ($rustIntegrationResult -eq 0) {
    Write-Host "checkmark Rust Integration Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "x Rust Integration Tests: FAILED" -ForegroundColor Red
}

if ($rustDeviceResult -eq 0) {
    Write-Host "checkmark Rust Device Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "x Rust Device Tests: FAILED" -ForegroundColor Red
}

if ($rustApiResult -eq 0) {
    Write-Host "checkmark Rust API Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "x Rust API Tests: FAILED" -ForegroundColor Red
}

if ($frontendUnitResult -eq 0) {
    Write-Host "checkmark Frontend Unit Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "x Frontend Unit Tests: FAILED" -ForegroundColor Red
}

if ($frontendComponentResult -eq 0) {
    Write-Host "checkmark Frontend Component Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "x Frontend Component Tests: FAILED" -ForegroundColor Red
}

if ($e2eResult -eq 0) {
    Write-Host "checkmark End-to-End Tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "x End-to-End Tests: FAILED" -ForegroundColor Red
}

Write-Host ""

# Calculate overall result
$totalFailures = 0
if ($rustUnitResult -ne 0) { $totalFailures++ }
if ($rustIntegrationResult -ne 0) { $totalFailures++ }
if ($rustDeviceResult -ne 0) { $totalFailures++ }
if ($rustApiResult -ne 0) { $totalFailures++ }
if ($frontendUnitResult -ne 0) { $totalFailures++ }
if ($frontendComponentResult -ne 0) { $totalFailures++ }
if ($e2eResult -ne 0) { $totalFailures++ }

if ($totalFailures -eq 0) {
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "SOME TESTS FAILED" -ForegroundColor Red
    Write-Host "Total failed test suites: $totalFailures" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
