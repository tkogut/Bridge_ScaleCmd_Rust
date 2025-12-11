#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build release artifacts and create a Windows installer package.

.DESCRIPTION
    Runs the backend release build, compiles the React frontend, and uses
    Create-InstallerPackage.ps1 to produce a ready-to-distribute ZIP archive.

.PARAMETER Version
    Optional version string to use in the package name. Falls back to Cargo or
    package.json versions before defaulting to 1.0.0.

.PARAMETER OutputPath
    Directory where the installer ZIP and intermediate package folder will be
    written. Defaults to "./release".

.PARAMETER SkipBackend
    Skip the Rust backend build step.

.PARAMETER SkipFrontend
    Skip the frontend build step.

.PARAMETER SkipInstaller
    Skip packaging and stop after building artifacts.
>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
    [string]$Version,
    [string]$OutputPath = ".\release",
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipInstaller
)

function Get-VersionFromCargo {
    $cargoFile = Join-Path $repoRoot "src-rust\Cargo.toml"
    if (-not (Test-Path $cargoFile)) {
        return $null
    }

    $content = Get-Content $cargoFile
    foreach ($line in $content) {
        if ($line -match '^\s*version\s*=\s*"([^"]+)"') {
            return $Matches[1]
        }
    }

    return $null
}

function Get-VersionFromPackageJson {
    $packageFile = Join-Path $repoRoot "package.json"
    if (-not (Test-Path $packageFile)) {
        return $null
    }

    try {
        $parsed = Get-Content $packageFile -Raw | ConvertFrom-Json
        return $parsed.version
    } catch {
        return $null
    }
}

function Resolve-OutputPath($path) {
    $resolved = $null
    if (Test-Path $path) {
        $resolved = (Resolve-Path -LiteralPath $path).Path
    } else {
        $resolved = (New-Item -ItemType Directory -Path $path -Force).FullName
    }
    return $resolved
}

function Run-Command([string]$label, [scriptblock]$command) {
    Write-Host ""
    Write-Host "==> $label" -ForegroundColor Cyan
    try {
        & $command
    } catch {
        Write-Host "ERROR: $label failed - $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

$repoRoot = Split-Path -Parent (Resolve-Path $PSCommandPath)
Set-Location $repoRoot

if (-not $Version) {
    $Version = Get-VersionFromCargo
}

if (-not $Version) {
    $Version = Get-VersionFromPackageJson
}

if (-not $Version -or $Version -eq "0.0.0") {
    $Version = "1.0.0"
}

$resolvedOutput = Resolve-OutputPath $OutputPath

Write-Host "Preparing installer for ScaleIT Bridge" -ForegroundColor Green
Write-Host "Repository root: $repoRoot"
Write-Host "Package version: $Version"
Write-Host "Artifacts directory: $resolvedOutput"

if (-not $SkipBackend) {
    Run-Command "Backend release build" { & "$repoRoot\build-rust-mingw.ps1" }
} else {
    Write-Host "Skipping backend build"
}

if (-not $SkipFrontend) {
    if (-not (Test-Path "$repoRoot\package.json")) {
        throw "Unable to locate package.json in $repoRoot"
    }

    Run-Command "Installing frontend dependencies" { npm install }
    Run-Command "Building frontend (Vite)" { npm run build }
} else {
    Write-Host "Skipping frontend build"
}

if (-not $SkipInstaller) {
    $installerScript = Join-Path $repoRoot "Create-InstallerPackage.ps1"
    Run-Command "Creating installer package" {
        & $installerScript -Version $Version -OutputPath $resolvedOutput
    }
} else {
    Write-Host "Skipping installer packaging"
}

Write-Host ""
Write-Host "Installer prep complete. Look for ZIP files under: $resolvedOutput" -ForegroundColor Green

