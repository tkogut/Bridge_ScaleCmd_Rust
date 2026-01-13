# Uninstall-Mosquitto.ps1
# Script to uninstall Mosquitto MQTT Broker Windows Service
# Must be run as Administrator

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallDir = "$env:ProgramFiles\mosquitto",
    
    [Parameter(Mandatory=$false)]
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

# Check for administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mosquitto MQTT Broker Uninstallation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ServiceName = "mosquitto"

# Check if service exists
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "Stopping Mosquitto service..." -ForegroundColor Yellow
    
    if ($service.Status -eq 'Running') {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Remove service using sc.exe
    Write-Host "Removing Mosquitto service..." -ForegroundColor Yellow
    & sc.exe delete $ServiceName
    Start-Sleep -Seconds 2
    
    Write-Host "Mosquitto service removed." -ForegroundColor Green
} else {
    Write-Host "Mosquitto service not found." -ForegroundColor Yellow
}

# Remove firewall rules
Write-Host "Removing firewall rules..." -ForegroundColor Yellow
$firewallRules = Get-NetFirewallRule -DisplayName "Mosquitto*" -ErrorAction SilentlyContinue
foreach ($rule in $firewallRules) {
    Remove-NetFirewallRule -DisplayName $rule.DisplayName
    Write-Host "  Removed: $($rule.DisplayName)" -ForegroundColor Gray
}

# Optionally remove installation directory
if (Test-Path $InstallDir) {
    if (-not $Quiet) {
        $response = Read-Host "Do you want to remove Mosquitto installation directory? (y/N)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Write-Host "Removing installation directory..." -ForegroundColor Yellow
            Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "Installation directory removed." -ForegroundColor Green
        } else {
            Write-Host "Installation directory kept at: $InstallDir" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Uninstallation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

if (-not $Quiet) {
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
