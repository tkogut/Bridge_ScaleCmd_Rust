# PowerShell script to check workspace compilation with MinGW toolchain
# This script configures MinGW environment and runs cargo check on the workspace

Write-Host "Checking workspace compilation with MinGW toolchain..." -ForegroundColor Green
Write-Host ""

# Ensure we run from the script directory
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $repoRoot

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
# IMPORTANT: mingwCrossBinPath must be in PATH for dlltool.exe to be found
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
Write-Host "  AR: $env:AR (from cross path)" -ForegroundColor Gray
Write-Host "  LINKER: $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER" -ForegroundColor Gray
Write-Host "  PATH includes: $mingwCrossBinPath (for dlltool.exe)" -ForegroundColor Gray
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
        Write-Host "  [OK] $($tool.Name) found" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] $($tool.Name) not found at $($tool.Path)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Set Rust toolchain to GNU
Write-Host "Setting Rust toolchain to GNU..." -ForegroundColor Yellow
try {
    rustup default stable-x86_64-pc-windows-gnu 2>&1 | Out-Null
    Write-Host "Rust GNU toolchain activated" -ForegroundColor Green
} catch {
    Write-Host "Warning: Failed to set Rust toolchain. Continuing anyway..." -ForegroundColor Yellow
}

Write-Host ""

# Navigate to Rust source directory
if (-not (Test-Path "src-rust")) {
    Write-Host "Error: src-rust directory not found" -ForegroundColor Red
    exit 1
}

Set-Location "src-rust"
Write-Host "Changed to src-rust directory" -ForegroundColor Gray
Write-Host ""

# Check workspace compilation
Write-Host "Checking workspace compilation..." -ForegroundColor Yellow
Write-Host "This will check all crates: scaleit-bridge, scaleit-host, scaleit-miernik" -ForegroundColor Gray
Write-Host ""

cargo check --workspace

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "════════════════════════════════════════" -ForegroundColor Green
    Write-Host "Workspace compilation check: SUCCESS ✅" -ForegroundColor Green
    Write-Host "════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "All crates compile successfully:" -ForegroundColor Cyan
    Write-Host "  • scaleit-host" -ForegroundColor White
    Write-Host "  • scaleit-miernik" -ForegroundColor White
    Write-Host "  • scaleit-bridge" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "════════════════════════════════════════" -ForegroundColor Red
    Write-Host "Workspace compilation check: FAILED ❌" -ForegroundColor Red
    Write-Host "════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

