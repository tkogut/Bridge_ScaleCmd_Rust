# Start-Mosquitto-Task.ps1
# Create Windows Task Scheduler job to run Mosquitto at startup
# Run as Administrator

param(
    [Parameter(Mandatory=$false)]
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# Check for administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

$TaskName = "Mosquitto MQTT Broker"
$InstallDir = "C:\Program Files\mosquitto"
$MosquittoExe = "$InstallDir\mosquitto.exe"
$ConfigFile = "$InstallDir\config\mosquitto.conf"

# Mosquitto version to install
$MosquittoVersion = "2.0.18"
$MosquittoUrl = "https://mosquitto.org/files/binary/win64/mosquitto-$MosquittoVersion-install-windows-x64.exe"
$DownloadPath = "$env:TEMP\mosquitto-installer.exe"

if ($Uninstall) {
    Write-Host "Removing Mosquitto task..." -ForegroundColor Yellow
    
    # Stop any running mosquitto processes
    Get-Process mosquitto -ErrorAction SilentlyContinue | Stop-Process -Force
    
    # Remove scheduled task
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    
    Write-Host "Mosquitto task removed." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mosquitto Task Scheduler Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Mosquitto needs to be installed
$needsInstall = $false
if (-not (Test-Path $InstallDir)) {
    $needsInstall = $true
} else {
    $hasFiles = (Get-ChildItem -Path $InstallDir -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0
    if (-not $hasFiles) {
        $needsInstall = $true
    }
}

if ($needsInstall) {
    # Download Mosquitto installer
    Write-Host "Downloading Mosquitto $MosquittoVersion..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $MosquittoUrl -OutFile $DownloadPath -UseBasicParsing
        Write-Host "Download completed." -ForegroundColor Green
    } catch {
        Write-Error "Failed to download Mosquitto: $_"
        exit 1
    }

    # Install Mosquitto silently
    Write-Host "Installing Mosquitto to $InstallDir..." -ForegroundColor Cyan
    try {
        $installArgs = "/S /D=$InstallDir"
        Start-Process -FilePath $DownloadPath -ArgumentList $installArgs -Wait -NoNewWindow
        Write-Host "Installation completed." -ForegroundColor Green
    } catch {
        Write-Error "Failed to install Mosquitto: $_"
        exit 1
    }

    # Clean up installer
    Remove-Item -Path $DownloadPath -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "Mosquitto is already installed at: $InstallDir" -ForegroundColor Green
}

# Stop any existing mosquitto processes
Write-Host "Stopping existing Mosquitto processes..." -ForegroundColor Cyan
Get-Process mosquitto -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Remove old service if exists
$service = Get-Service -Name "mosquitto" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Removing old Mosquitto service..." -ForegroundColor Yellow
    sc.exe stop mosquitto 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    sc.exe delete mosquitto 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Remove existing task
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Create simple config in Program Files
Write-Host "Creating Mosquitto configuration..." -ForegroundColor Cyan
$configContent = @"
# Mosquitto Configuration for ScaleIT Bridge
listener 1883 0.0.0.0
protocol mqtt
allow_anonymous true
persistence false
max_connections -1
"@

Set-Content -Path $ConfigFile -Value $configContent -Force
Write-Host "Configuration created: $ConfigFile" -ForegroundColor Green

# Create scheduled task to run at startup
Write-Host "Creating scheduled task..." -ForegroundColor Cyan

$Action = New-ScheduledTaskAction -Execute $MosquittoExe -Argument "-c `"$ConfigFile`" -v"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 365)
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null

Write-Host "Scheduled task created successfully." -ForegroundColor Green

# Start the task now
Write-Host "Starting Mosquitto..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 5

# Check if running
$running = Get-Process mosquitto -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "Mosquitto is running! (PID: $($running.Id))" -ForegroundColor Green
} else {
    Write-Warning "Mosquitto may not have started. Check Task Scheduler logs."
}

# Test connection
Write-Host "`nTesting MQTT connection..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
$portTest = Test-NetConnection -ComputerName localhost -Port 1883 -InformationLevel Quiet

if ($portTest) {
    Write-Host "Port 1883 is accessible!" -ForegroundColor Green
} else {
    Write-Warning "Port 1883 is not accessible. Mosquitto may still be starting..."
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Mosquitto Details:" -ForegroundColor Cyan
Write-Host "  Executable: $MosquittoExe" -ForegroundColor White
Write-Host "  Config: $ConfigFile" -ForegroundColor White
Write-Host "  Task Name: $TaskName" -ForegroundColor White
Write-Host "  Status: Running at startup" -ForegroundColor White
Write-Host ""
Write-Host "To manage Mosquitto:" -ForegroundColor Cyan
Write-Host "  Start:   Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host "  Stop:    Get-Process mosquitto | Stop-Process -Force" -ForegroundColor White
Write-Host "  Status:  Get-Process mosquitto" -ForegroundColor White
Write-Host "  Uninstall: .\Start-Mosquitto-Task.ps1 -Uninstall" -ForegroundColor White
Write-Host ""
