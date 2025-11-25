#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Checks all prerequisites for building ScaleIT Bridge on Windows

.DESCRIPTION
    This script verifies that all required software is installed and configured
    correctly for building the ScaleIT Bridge project.

.EXAMPLE
    .\Check-Prerequisites.ps1
#>

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent (Resolve-Path $PSCommandPath)

function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Show-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "═" * 50 -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "═" * 50 -ForegroundColor Cyan
}

function Show-Pass {
    param([string]$Message)
    Write-Host "  ✓ $Message" -ForegroundColor Green
}

function Show-Fail {
    param([string]$Message)
    Write-Host "  ✗ $Message" -ForegroundColor Red
}

function Show-Warn {
    param([string]$Message)
    Write-Host "  ⚠ $Message" -ForegroundColor Yellow
}

function Show-Info {
    param([string]$Message)
    Write-Host "  ℹ $Message" -ForegroundColor Cyan
}

# Start checks
Write-Host ""
Write-Host "ScaleIT Bridge - Prerequisites Check" -ForegroundColor Green
Write-Host ""

$allPassed = $true

# ============================================================================
# Check Rust
# ============================================================================
Show-Section "Rust Toolchain"

if (Test-Command "rustc") {
    $rustcVersion = & rustc --version
    Show-Pass $rustcVersion
    
    if (Test-Command "cargo") {
        $cargoVersion = & cargo --version
        Show-Pass $cargoVersion
    } else {
        Show-Fail "Cargo not found (should come with Rust)"
        $allPassed = $false
    }
    
    # Check for MSVC target
    $targets = & rustup target list 2>&1 | Select-String "x86_64-pc-windows-msvc"
    if ($targets) {
        Show-Pass "MSVC target installed"
    } else {
        Show-Warn "MSVC target not installed"
        Show-Info "Run: rustup target add x86_64-pc-windows-msvc"
    }
} else {
    Show-Fail "Rust not found"
    Show-Info "Download from: https://rustup.rs/"
    $allPassed = $false
}

# ============================================================================
# Check MSVC Compiler
# ============================================================================
Show-Section "MSVC Compiler Toolchain"

if (Test-Command "cl.exe") {
    $clVersion = & cl.exe 2>&1 | Select-Object -First 1
    Show-Pass "MSVC C++ Compiler (cl.exe) found"
    Show-Info $clVersion
    
    if (Test-Command "link.exe") {
        Show-Pass "MSVC Linker (link.exe) found"
    } else {
        Show-Fail "MSVC Linker (link.exe) not found"
        Show-Info "Run from: Developer PowerShell for Visual Studio"
        $allPassed = $false
    }
} else {
    Show-Fail "MSVC C++ Compiler (cl.exe) not found"
    Show-Warn "Visual Studio Build Tools with C++ option required"
    Show-Info "Download: https://visualstudio.microsoft.com/downloads/"
    Show-Info "Select: Build Tools for Visual Studio 2022"
    Show-Info "Include: Desktop development with C++"
    $allPassed = $false
}

# ============================================================================
# Check Node.js (for frontend)
# ============================================================================
Show-Section "Node.js & npm (Frontend)"

if (Test-Command "node") {
    $nodeVersion = & node --version
    Show-Pass "Node.js $nodeVersion"
    
    if (Test-Command "npm") {
        $npmVersion = & npm --version
        Show-Pass "npm $npmVersion"
    } else {
        Show-Fail "npm not found (should come with Node.js)"
        $allPassed = $false
    }
    
    # Check for pnpm (optional)
    if (Test-Command "pnpm") {
        $pnpmVersion = & pnpm --version
        Show-Pass "pnpm $pnpmVersion (optional)"
    } else {
        Show-Warn "pnpm not installed (optional, npm will be used)"
    }
} else {
    Show-Warn "Node.js not found (required for frontend builds)"
    Show-Info "Download: https://nodejs.org/"
    Show-Info "Choose: LTS version recommended"
}

# ============================================================================
# Check Git
# ============================================================================
Show-Section "Version Control"

if (Test-Command "git") {
    $gitVersion = & git --version
    Show-Pass $gitVersion
} else {
    Show-Warn "Git not found (optional, not required to build)"
    Show-Info "Download: https://git-scm.com/"
}

# ============================================================================
# Check Project Files
# ============================================================================
Show-Section "Project Structure"

$requiredFiles = @(
    @{ Path = "Cargo.toml"; Type = "root"; Required = $true },
    @{ Path = "src-rust\Cargo.toml"; Type = "backend"; Required = $true },
    @{ Path = "src-rust\src\main.rs"; Type = "backend"; Required = $true },
    @{ Path = "package.json"; Type = "frontend"; Required = $true },
    @{ Path = "tsconfig.json"; Type = "frontend"; Required = $true },
    @{ Path = "src-rust\config\devices.json"; Type = "config"; Required = $false }
)

foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $ScriptDir $file.Path
    if (Test-Path $fullPath) {
        if ($file.Required) {
            Show-Pass "$($file.Type): $($file.Path)"
        } else {
            Show-Info "$($file.Type): $($file.Path) (optional)"
        }
    } else {
        if ($file.Required) {
            Show-Fail "$($file.type): $($file.Path) - MISSING"
            $allPassed = $false
        } else {
            Show-Warn "$($file.Type): $($file.Path) (will be created)"
        }
    }
}

# ============================================================================
# Check Disk Space
# ============================================================================
Show-Section "System Resources"

$drive = (Get-Item $ScriptDir).PSDrive.Name
$driveInfo = Get-PSDrive $drive
$freeSpace = $driveInfo.Free / 1GB

if ($freeSpace -gt 5) {
    Show-Pass "Free disk space: $([Math]::Round($freeSpace, 2)) GB"
} else {
    Show-Warn "Low disk space: $([Math]::Round($freeSpace, 2)) GB"
    Show-Info "Recommended: At least 5 GB for builds"
}

# Check available RAM (approximate)
$memoryInfo = Get-CimInstance Win32_OperatingSystem
$freeMemory = $memoryInfo.FreePhysicalMemory / 1MB
Show-Info "Available RAM: $([Math]::Round($freeMemory, 0)) MB"

if ($freeMemory -lt 512) {
    Show-Warn "Low available RAM - compilation may be slow"
}

# ============================================================================
# Check Environment
# ============================================================================
Show-Section "Build Environment"

if ($env:RUST_BACKTRACE) {
    Show-Pass "RUST_BACKTRACE = $env:RUST_BACKTRACE"
} else {
    Show-Info "RUST_BACKTRACE not set (can be enabled for debugging)"
}

if ($env:CARGO_INCREMENTAL) {
    Show-Info "CARGO_INCREMENTAL = $env:CARGO_INCREMENTAL"
} else {
    Show-Info "CARGO_INCREMENTAL not set (builds will be incremental by default)"
}

# ============================================================================
# Summary
# ============================================================================
Show-Section "Summary"

if ($allPassed) {
    Write-Host ""
    Write-Host "✓ All required prerequisites are installed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Cyan
    Write-Host "  .\BUILD.bat" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✗ Some prerequisites are missing" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install the missing components listed above and try again." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
