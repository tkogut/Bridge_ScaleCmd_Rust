# Install-Mosquitto.ps1
# Script to install Mosquitto MQTT Broker as Windows Service
# Must be run as Administrator

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallDir = "$env:ProgramFiles\mosquitto",
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 1883,
    
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
Write-Host "Mosquitto MQTT Broker Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Mosquitto version to install
$MosquittoVersion = "2.0.18"
$MosquittoUrl = "https://mosquitto.org/files/binary/win64/mosquitto-$MosquittoVersion-install-windows-x64.exe"
$DownloadPath = "$env:TEMP\mosquitto-installer.exe"

# Check if port 1883 is already in use
Write-Host "Checking if port 1883 is in use..." -ForegroundColor Cyan
$portInUse = Get-NetTCPConnection -LocalPort 1883 -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "Port 1883 is in use. Cleaning up..." -ForegroundColor Yellow
    
    # Stop Docker containers using port 1883
    Write-Host "Checking for Docker containers..." -ForegroundColor Yellow
    try {
        $dockerContainers = docker ps -a --filter "publish=1883" --format "{{.Names}}" 2>$null
        if ($dockerContainers) {
            foreach ($container in $dockerContainers) {
                Write-Host "  Stopping Docker container: $container" -ForegroundColor Yellow
                docker stop $container 2>$null
                docker rm $container 2>$null
            }
        }
        
        # Also check for containers named mosquitto
        $mosquittoContainers = docker ps -a --filter "name=mosquitto" --format "{{.Names}}" 2>$null
        if ($mosquittoContainers) {
            foreach ($container in $mosquittoContainers) {
                Write-Host "  Removing Docker container: $container" -ForegroundColor Yellow
                docker stop $container 2>$null
                docker rm $container 2>$null
            }
        }
    } catch {
        Write-Host "  Docker not available or no containers found." -ForegroundColor Gray
    }
    
    # Check if port is still in use
    Start-Sleep -Seconds 3
    $portStillInUse = Get-NetTCPConnection -LocalPort 1883 -ErrorAction SilentlyContinue
    
    if ($portStillInUse) {
        # Kill processes using port 1883
        Write-Host "  Finding processes using port 1883..." -ForegroundColor Yellow
        $processIds = $portStillInUse | Select-Object -ExpandProperty OwningProcess -Unique
        
        foreach ($processId in $processIds) {
            try {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "  Stopping process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force
                }
            } catch {
                Write-Host "  Could not stop process $processId" -ForegroundColor Gray
            }
        }
        
        Start-Sleep -Seconds 2
    }
    
    Write-Host "Port 1883 cleanup completed." -ForegroundColor Green
}

# Check if Mosquitto is already installed
$ServiceName = "mosquitto"
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "Mosquitto service already exists. Checking status..." -ForegroundColor Yellow
    
    if ($service.Status -eq 'Running') {
        Write-Host "Stopping Mosquitto service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 2
    }
    
    # Uninstall existing service
    Write-Host "Removing existing Mosquitto service..." -ForegroundColor Yellow
    & sc.exe delete $ServiceName
    Start-Sleep -Seconds 2
}

# Check if install directory exists and has files
if (Test-Path $InstallDir) {
    $hasFiles = (Get-ChildItem -Path $InstallDir -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0
    if ($hasFiles) {
        Write-Host "Mosquitto is already installed at: $InstallDir" -ForegroundColor Green
        Write-Host "Skipping download and installation." -ForegroundColor Green
        $skipInstall = $true
    }
} else {
    $skipInstall = $false
}

if (-not $skipInstall) {
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
}

# Create configuration file
Write-Host "Creating Mosquitto configuration..." -ForegroundColor Cyan
$ConfigDir = Join-Path $InstallDir "config"
$ConfigFile = Join-Path $ConfigDir "mosquitto.conf"

if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

$configContent = @"
# Mosquitto Configuration for ScaleIT Bridge
# Generated automatically by Install-Mosquitto.ps1

# Listener configuration
listener $Port
protocol mqtt

# Allow anonymous connections (for local network only)
allow_anonymous true

# Persistence
persistence true
persistence_location $InstallDir\data

# Logging
log_dest file $InstallDir\logs\mosquitto.log
log_type error
log_type warning
log_type notice
log_type information

# Connection settings
max_connections -1
"@

Set-Content -Path $ConfigFile -Value $configContent -Force
Write-Host "Configuration file created: $ConfigFile" -ForegroundColor Green

# Create necessary directories
$DataDir = Join-Path $InstallDir "data"
$LogDir = Join-Path $InstallDir "logs"

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Grant SYSTEM account full access to directories (required for Windows Service)
Write-Host "Setting directory permissions..." -ForegroundColor Cyan
try {
    # Grant SYSTEM full control to data directory
    & icacls $DataDir /grant "NT AUTHORITY\SYSTEM:(OI)(CI)F" /T /Q | Out-Null
    # Grant SYSTEM full control to logs directory
    & icacls $LogDir /grant "NT AUTHORITY\SYSTEM:(OI)(CI)F" /T /Q | Out-Null
    # Grant SYSTEM read access to config directory
    & icacls $ConfigDir /grant "NT AUTHORITY\SYSTEM:(OI)(CI)R" /T /Q | Out-Null
    Write-Host "Directory permissions set successfully." -ForegroundColor Green
} catch {
    Write-Warning "Could not set directory permissions. Service may not start correctly."
}

# Install as Windows Service using sc.exe
Write-Host "Installing Mosquitto as Windows Service..." -ForegroundColor Cyan
$MosquittoExe = Join-Path $InstallDir "mosquitto.exe"

if (-not (Test-Path $MosquittoExe)) {
    Write-Error "Mosquitto executable not found at: $MosquittoExe"
    exit 1
}

# Create simplified config without file logging (console only)
Write-Host "Creating simplified configuration..." -ForegroundColor Cyan
$SimpleConfigFile = Join-Path $ConfigDir "mosquitto-service.conf"
$simpleConfigContent = @"
# Mosquitto Configuration for Windows Service
# Simplified version - logs to console (captured by service manager)

listener $Port
protocol mqtt
allow_anonymous true
persistence true
persistence_location $DataDir
max_connections -1
"@

Set-Content -Path $SimpleConfigFile -Value $simpleConfigContent -Force
if (-not (Test-Path $SimpleConfigFile)) {
    Write-Error "Failed to create simplified configuration at: $SimpleConfigFile"
    exit 1
}

Write-Host "Simplified configuration created: $SimpleConfigFile" -ForegroundColor Green

Write-Host "Locating NSSM (Non-Sucking Service Manager)..." -ForegroundColor Cyan

# Check if NSSM already exists from ScaleCmdBridge installation
$nssmExisting = "$env:ProgramFiles\ScaleCmdBridge\nssm.exe"
$nssmExe = $null

if (Test-Path $nssmExisting) {
    Write-Host "  Found existing NSSM from ScaleCmdBridge: $nssmExisting" -ForegroundColor Green
    $nssmExe = $nssmExisting
} else {
    # Try to download NSSM
    Write-Host "  NSSM not found locally, downloading..." -ForegroundColor Yellow
    $nssmVersion = "2.24"
    $nssmUrl = "https://github.com/kirillkovalenko/nssm/releases/download/$nssmVersion/nssm-$nssmVersion.zip"
    $nssmZip = "$env:TEMP\nssm.zip"
    $nssmExtract = "$env:TEMP\nssm"
    $nssmTempExe = "$nssmExtract\nssm-$nssmVersion\win64\nssm.exe"
    
    try {
        # Try GitHub first
        try {
            Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing -ErrorAction Stop
        } catch {
            # Fallback to official nssm.cc
            Write-Host "    GitHub unavailable, trying nssm.cc..." -ForegroundColor Yellow
            $nssmUrl = "https://nssm.cc/release/nssm-$nssmVersion.zip"
            Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing -ErrorAction Stop
        }
        
        Expand-Archive -Path $nssmZip -DestinationPath $nssmExtract -Force
        
        if (-not (Test-Path $nssmTempExe)) {
            throw "NSSM executable not found after extraction"
        }
        
        $nssmExe = $nssmTempExe
        Write-Host "  NSSM downloaded successfully." -ForegroundColor Green
    } catch {
        Write-Error "Failed to download NSSM: $_. Please install ScaleCmdBridge first or manually download NSSM."
        exit 1
    }
}

if (-not $nssmExe) {
    Write-Error "NSSM not found. Please install ScaleCmdBridge first."
    exit 1
}

Write-Host "Registering Windows Service with NSSM..." -ForegroundColor Cyan

try {
    # Copy NSSM to permanent location (Mosquitto directory)
    $nssmPermanent = Join-Path $InstallDir "nssm.exe"
    Copy-Item -Path $nssmExe -Destination $nssmPermanent -Force
    Write-Host "NSSM copied to: $nssmPermanent" -ForegroundColor Gray
    
    # Grant LocalService permissions to directories BEFORE creating service
    & icacls $DataDir /grant "NT AUTHORITY\LocalService:(OI)(CI)F" /T /Q | Out-Null
    & icacls $LogDir /grant "NT AUTHORITY\LocalService:(OI)(CI)F" /T /Q | Out-Null
    & icacls $ConfigDir /grant "NT AUTHORITY\LocalService:(OI)(CI)R" /T /Q | Out-Null
    & icacls $InstallDir /grant "NT AUTHORITY\LocalService:(OI)(CI)RX" /T /Q | Out-Null
    
    # Install service using NSSM from permanent location
    & $nssmPermanent install $ServiceName $MosquittoExe -c $SimpleConfigFile -v
    
    # Configure service
    & $nssmPermanent set $ServiceName DisplayName "Eclipse Mosquitto MQTT Broker"
    & $nssmPermanent set $ServiceName Description "Eclipse Mosquitto MQTT Broker for ScaleIT Bridge"
    & $nssmPermanent set $ServiceName Start SERVICE_AUTO_START
    & $nssmPermanent set $ServiceName ObjectName "NT AUTHORITY\LocalService"
    
    Write-Host "Mosquitto service registered successfully with NSSM." -ForegroundColor Green
    
    # Clean up temporary NSSM files if they were downloaded (but keep the permanent copy)
    if (Test-Path variable:nssmZip) {
        Remove-Item -Path $nssmZip -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path variable:nssmExtract) {
        Remove-Item -Path $nssmExtract -Recurse -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Error "Failed to create Mosquitto service with NSSM: $_"
    exit 1
}

# Add Windows Firewall rule
Write-Host "Configuring Windows Firewall..." -ForegroundColor Cyan
$firewallRuleName = "Mosquitto MQTT Broker - Port $Port"

# Remove existing rule if it exists
$existingRule = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
if ($existingRule) {
    Write-Host "Removing existing firewall rule..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName $firewallRuleName
}

# Add new firewall rule
New-NetFirewallRule -DisplayName $firewallRuleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port `
    -Profile Private `
    -Description "Allows MQTT broker access from local network for ScaleIT Bridge" | Out-Null

Write-Host "Firewall rule added successfully." -ForegroundColor Green

# Start Mosquitto service
Write-Host "Starting Mosquitto service..." -ForegroundColor Cyan
Start-Service -Name $ServiceName
Start-Sleep -Seconds 2

# Check service status
$service = Get-Service -Name $ServiceName
if ($service.Status -eq 'Running') {
    Write-Host "Mosquitto service is running!" -ForegroundColor Green
} else {
    Write-Warning "Mosquitto service status: $($service.Status)"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Mosquitto Details:" -ForegroundColor Cyan
Write-Host "  Installation: $InstallDir" -ForegroundColor White
Write-Host "  Configuration: $ConfigFile" -ForegroundColor White
Write-Host "  Port: $Port" -ForegroundColor White
Write-Host "  Service Name: $ServiceName" -ForegroundColor White
Write-Host "  Status: $($service.Status)" -ForegroundColor White
Write-Host ""
Write-Host "The broker is now accessible at:" -ForegroundColor Cyan
Write-Host "  - localhost:$Port (this computer)" -ForegroundColor White
Write-Host "  - <your-ip>:$Port (from local network)" -ForegroundColor White
Write-Host ""
Write-Host "To manage the service:" -ForegroundColor Cyan
Write-Host "  Start:   net start $ServiceName" -ForegroundColor White
Write-Host "  Stop:    net stop $ServiceName" -ForegroundColor White
Write-Host "  Status:  sc query $ServiceName" -ForegroundColor White
Write-Host ""

if (-not $Quiet) {
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
