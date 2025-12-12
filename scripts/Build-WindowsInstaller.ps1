#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Builds complete Windows installer for ScaleCmdBridge

.DESCRIPTION
    This script:
    1. Builds Rust backend (release)
    2. Builds React frontend (production)
    3. Downloads/copies NSSM
    4. Compiles Inno Setup installer
    5. Creates ScaleCmdBridge-Setup-x64.exe

.PARAMETER Version
    Version string for the installer (default: from Cargo.toml)

.PARAMETER SkipBackend
    Skip Rust backend build

.PARAMETER SkipFrontend
    Skip React frontend build

.PARAMETER SkipNSSM
    Skip NSSM download (assumes it's already in installer/nssm/)

.PARAMETER SkipInstaller
    Skip Inno Setup compilation

.EXAMPLE
    .\scripts\Build-WindowsInstaller.ps1
    .\scripts\Build-WindowsInstaller.ps1 -Version "1.0.0"
#>

param(
    [string]$Version,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipNSSM,
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
$InformationPreference = "Continue"

# Script directory
$ScriptDir = Split-Path -Parent (Resolve-Path $PSCommandPath)
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "ScaleCmdBridge - Windows Installer Builder" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Get version from Cargo.toml if not provided
if (-not $Version) {
    $cargoFile = Join-Path $RepoRoot "src-rust\Cargo.toml"
    if (Test-Path $cargoFile) {
        $cargoContent = Get-Content $cargoFile
        foreach ($line in $cargoContent) {
            if ($line -match '^\s*version\s*=\s*"([^"]+)"') {
                $Version = $Matches[1]
                break
            }
        }
    }
    if (-not $Version) {
        $Version = "1.0.0"
    }
}

Write-Host "Version: $Version" -ForegroundColor Cyan
Write-Host "Repository: $RepoRoot" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Rust backend
if (-not $SkipBackend) {
    Write-Host "[1/4] Building Rust backend (release)..." -ForegroundColor Yellow
    Write-Host ""
    
    $buildScript = Join-Path $RepoRoot "build-rust-mingw.ps1"
    if (Test-Path $buildScript) {
        & $buildScript -Release
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Backend build failed!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "ERROR: build-rust-mingw.ps1 not found!" -ForegroundColor Red
        exit 1
    }
    
    # Try standard release path first, then GNU-specific path
    $exePath = Join-Path $RepoRoot "src-rust\target\release\scaleit-bridge.exe"
    if (-not (Test-Path $exePath)) {
        $exePath = Join-Path $RepoRoot "src-rust\target\x86_64-pc-windows-gnu\release\scaleit-bridge.exe"
    }
    if (-not (Test-Path $exePath)) {
        Write-Host "ERROR: Backend executable not found. Tried:" -ForegroundColor Red
        Write-Host "  - src-rust\target\release\scaleit-bridge.exe" -ForegroundColor Red
        Write-Host "  - src-rust\target\x86_64-pc-windows-gnu\release\scaleit-bridge.exe" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Backend built successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[1/4] Skipping backend build" -ForegroundColor Gray
    Write-Host ""
}

# Step 2: Build React frontend
if (-not $SkipFrontend) {
    Write-Host "[2/4] Building React frontend (production)..." -ForegroundColor Yellow
    Write-Host ""
    
    Push-Location $RepoRoot
    try {
        if (-not (Test-Path "package.json")) {
            Write-Host "ERROR: package.json not found!" -ForegroundColor Red
            exit 1
        }
        
        # Install dependencies if needed
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing npm dependencies..." -ForegroundColor Gray
            npm install
        }
        
        # Build frontend
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
            exit 1
        }
        
        $distPath = Join-Path $RepoRoot "dist\index.html"
        if (-not (Test-Path $distPath)) {
            Write-Host "ERROR: Frontend build output not found at dist/index.html" -ForegroundColor Red
            exit 1
        }
        Write-Host "  ✓ Frontend built successfully" -ForegroundColor Green
    } finally {
        Pop-Location
    }
    Write-Host ""
} else {
    Write-Host "[2/4] Skipping frontend build" -ForegroundColor Gray
    Write-Host ""
}

# Step 3: Download/Copy NSSM
if (-not $SkipNSSM) {
    Write-Host "[3/4] Setting up NSSM..." -ForegroundColor Yellow
    Write-Host ""
    
    $nssmDir = Join-Path $RepoRoot "installer\nssm"
    $nssmExe = Join-Path $nssmDir "nssm.exe"
    
    if (-not (Test-Path $nssmExe)) {
        Write-Host "NSSM not found. Downloading..." -ForegroundColor Gray
        
        # Create directory
        New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null
        
        # Download NSSM (latest stable 2.24)
        $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
        $nssmZip = Join-Path $env:TEMP "nssm-2.24.zip"
        
        Write-Host "Downloading NSSM from $nssmUrl..." -ForegroundColor Gray
        try {
            Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
            
            # Extract
            Write-Host "Extracting NSSM..." -ForegroundColor Gray
            Expand-Archive -Path $nssmZip -DestinationPath $env:TEMP -Force
            
            # Copy 64-bit version
            $nssmSource = Join-Path $env:TEMP "nssm-2.24\win64\nssm.exe"
            if (Test-Path $nssmSource) {
                Copy-Item $nssmSource $nssmExe -Force
                Write-Host "  ✓ NSSM downloaded and extracted" -ForegroundColor Green
            } else {
                Write-Host "ERROR: NSSM executable not found in archive!" -ForegroundColor Red
                exit 1
            }
            
            # Cleanup
            Remove-Item $nssmZip -ErrorAction SilentlyContinue
            Remove-Item (Join-Path $env:TEMP "nssm-2.24") -Recurse -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "ERROR: Failed to download NSSM: $_" -ForegroundColor Red
            Write-Host "Please download NSSM manually from https://nssm.cc/download" -ForegroundColor Yellow
            Write-Host "Extract nssm.exe (64bit) to: $nssmExe" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "  ✓ NSSM found at $nssmExe" -ForegroundColor Green
    }
    Write-Host ""
} else {
    Write-Host "[3/4] Skipping NSSM setup" -ForegroundColor Gray
    Write-Host ""
}

# Step 4: Compile Inno Setup installer
if (-not $SkipInstaller) {
    Write-Host "[4/4] Compiling Inno Setup installer..." -ForegroundColor Yellow
    Write-Host ""
    
    $issFile = Join-Path $RepoRoot "installer\ScaleCmdBridge.iss"
    if (-not (Test-Path $issFile)) {
        Write-Host "ERROR: Inno Setup script not found at $issFile" -ForegroundColor Red
        exit 1
    }
    
    # Find Inno Setup Compiler (try both ISCC.exe and Compil32.exe)
    $innoSetupPaths = @(
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files (x86)\Inno Setup 6\Compil32.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\Compil32.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\Compil32.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\Compil32.exe"
    )
    
    $iscc = $null
    foreach ($path in $innoSetupPaths) {
        if (Test-Path $path) {
            $iscc = $path
            break
        }
    }
    
    if (-not $iscc) {
        Write-Host "ERROR: Inno Setup Compiler not found!" -ForegroundColor Red
        Write-Host "Please install Inno Setup from: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
        Write-Host "Or specify the path to ISCC.exe manually" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "Using Inno Setup: $iscc" -ForegroundColor Gray
    Write-Host "Compiling installer..." -ForegroundColor Gray
    
    # Update version in ISS file if needed
    $issContent = Get-Content $issFile -Raw
    if ($issContent -notmatch "MyAppVersion ""$Version""") {
        $issContent = $issContent -replace 'MyAppVersion ""[^""]+""', "MyAppVersion ""$Version"""
        Set-Content $issFile $issContent -NoNewline
    }
    
    # Compile (ISCC.exe uses direct execution, Compil32.exe needs /cc parameter)
    if ($iscc -like "*ISCC.exe") {
        # Command-line compiler
        & $iscc $issFile
    } else {
        # GUI compiler (Compil32.exe) - use /cc for command-line compilation
        & $iscc /cc $issFile
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Inno Setup compilation failed!" -ForegroundColor Red
        exit 1
    }
    
    $installerPath = Join-Path $RepoRoot "release\ScaleCmdBridge-Setup-x64.exe"
    if (Test-Path $installerPath) {
        $fileInfo = Get-Item $installerPath
        Write-Host "  ✓ Installer created successfully" -ForegroundColor Green
        Write-Host "  Location: $installerPath" -ForegroundColor Cyan
        Write-Host "  Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    } else {
        Write-Host "ERROR: Installer file not found after compilation!" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "[4/4] Skipping installer compilation" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host 'Installer ready: release/ScaleCmdBridge-Setup-x64.exe' -ForegroundColor Cyan
Write-Host ""

