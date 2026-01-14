# Configure-MQTT-Service.ps1
# Configures MQTT environment variables for ScaleCmdBridge Windows Service
# Must be run as Administrator

param(
    [Parameter(Mandatory=$false)]
    [switch]$Enable,
    
    [Parameter(Mandatory=$false)]
    [switch]$Disable,
    
    [Parameter(Mandatory=$false)]
    [switch]$Status,
    
    [Parameter(Mandatory=$false)]
    [string]$BrokerUrl = "mqtt://localhost:1883",
    
    [Parameter(Mandatory=$false)]
    [string]$ClientId = "scaleit-bridge",
    
    [Parameter(Mandatory=$false)]
    [string]$TopicPrefix = "scaleit",
    
    [Parameter(Mandatory=$false)]
    [string]$Username = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Password = "",
    
    [Parameter(Mandatory=$false)]
    [int]$QoS = 1,
    
    [Parameter(Mandatory=$false)]
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

# Service and paths
$ServiceName = "ScaleCmdBridge"
$InstallDir = "$env:ProgramFiles\ScaleCmdBridge"
$NssmExe = "$InstallDir\nssm.exe"
$MqttConfigFile = "$env:ProgramData\ScaleCmdBridge\mqtt.conf"

# Check for administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

# Verify NSSM exists
if (-not (Test-Path $NssmExe)) {
    Write-Error "NSSM not found at: $NssmExe. Is ScaleCmdBridge installed?"
    exit 1
}

# Verify service exists
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Error "Service '$ServiceName' not found. Is ScaleCmdBridge installed?"
    exit 1
}

function Write-Info {
    param([string]$Message)
    if (-not $Quiet) {
        Write-Host $Message -ForegroundColor Cyan
    }
}

function Write-Success {
    param([string]$Message)
    if (-not $Quiet) {
        Write-Host $Message -ForegroundColor Green
    }
}

function Get-CurrentMqttConfig {
    $config = @{
        Enabled = $false
        BrokerUrl = ""
        ClientId = ""
        TopicPrefix = ""
        Username = ""
        QoS = 1
    }
    
    try {
        $envVars = & $NssmExe get $ServiceName AppEnvironmentExtra 2>$null
        if ($envVars) {
            foreach ($line in $envVars -split "`n") {
                if ($line -match "MQTT_ENABLED=(.+)") { 
                    $config.Enabled = ($matches[1].Trim() -eq "true")
                }
                if ($line -match "MQTT_BROKER_URL=(.+)") { 
                    $config.BrokerUrl = $matches[1].Trim()
                }
                if ($line -match "MQTT_CLIENT_ID=(.+)") { 
                    $config.ClientId = $matches[1].Trim()
                }
                if ($line -match "MQTT_TOPIC_PREFIX=(.+)") { 
                    $config.TopicPrefix = $matches[1].Trim()
                }
                if ($line -match "MQTT_USERNAME=(.+)") { 
                    $config.Username = $matches[1].Trim()
                }
                if ($line -match "MQTT_QOS=(.+)") { 
                    $config.QoS = [int]$matches[1].Trim()
                }
            }
        }
    } catch {
        # Ignore errors, return default config
    }
    
    return $config
}

function Set-MqttEnvironment {
    param(
        [bool]$Enabled,
        [string]$BrokerUrl,
        [string]$ClientId,
        [string]$TopicPrefix,
        [string]$Username,
        [string]$Password,
        [int]$QoS
    )
    
    # Build environment string
    $envVars = @()
    $envVars += "MQTT_ENABLED=$($Enabled.ToString().ToLower())"
    
    if ($Enabled) {
        $envVars += "MQTT_BROKER_URL=$BrokerUrl"
        $envVars += "MQTT_CLIENT_ID=$ClientId"
        $envVars += "MQTT_TOPIC_PREFIX=$TopicPrefix"
        $envVars += "MQTT_QOS=$QoS"
        
        if ($Username) {
            $envVars += "MQTT_USERNAME=$Username"
        }
        if ($Password) {
            $envVars += "MQTT_PASSWORD=$Password"
        }
    }
    
    # Set environment variables via NSSM
    $envString = $envVars -join " "
    & $NssmExe set $ServiceName AppEnvironmentExtra $envString | Out-Null
}

# Show status
if ($Status) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "MQTT Configuration Status" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $config = Get-CurrentMqttConfig
    
    Write-Host "Service: $ServiceName" -ForegroundColor White
    Write-Host "Status:  $($service.Status)" -ForegroundColor White
    Write-Host ""
    Write-Host "MQTT Configuration:" -ForegroundColor Cyan
    Write-Host "  Enabled:      $($config.Enabled)" -ForegroundColor $(if ($config.Enabled) { "Green" } else { "Yellow" })
    Write-Host "  Broker URL:   $($config.BrokerUrl)" -ForegroundColor White
    Write-Host "  Client ID:    $($config.ClientId)" -ForegroundColor White
    Write-Host "  Topic Prefix: $($config.TopicPrefix)" -ForegroundColor White
    Write-Host "  Username:     $(if ($config.Username) { $config.Username } else { '(not set)' })" -ForegroundColor White
    Write-Host "  QoS:          $($config.QoS)" -ForegroundColor White
    Write-Host ""
    
    exit 0
}

# Enable MQTT
if ($Enable) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Enabling MQTT for $ServiceName" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Info "Configuring MQTT environment variables..."
    
    Set-MqttEnvironment -Enabled $true `
        -BrokerUrl $BrokerUrl `
        -ClientId $ClientId `
        -TopicPrefix $TopicPrefix `
        -Username $Username `
        -Password $Password `
        -QoS $QoS
    
    Write-Success "MQTT environment configured."
    
    # Restart service to apply changes
    Write-Info "Restarting service to apply changes..."
    try {
        Restart-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 3
        
        $service = Get-Service -Name $ServiceName
        if ($service.Status -eq 'Running') {
            Write-Success "Service restarted successfully."
        } else {
            Write-Warning "Service status: $($service.Status)"
        }
    } catch {
        Write-Warning "Could not restart service: $_"
        Write-Host "Please restart the service manually: Restart-Service $ServiceName" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "MQTT Enabled Successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  Broker URL:   $BrokerUrl" -ForegroundColor White
    Write-Host "  Client ID:    $ClientId" -ForegroundColor White
    Write-Host "  Topic Prefix: $TopicPrefix" -ForegroundColor White
    Write-Host "  QoS:          $QoS" -ForegroundColor White
    Write-Host ""
    Write-Host "To check status: .\Configure-MQTT-Service.ps1 -Status" -ForegroundColor Gray
    Write-Host "To disable MQTT: .\Configure-MQTT-Service.ps1 -Disable" -ForegroundColor Gray
    Write-Host ""
    
    exit 0
}

# Disable MQTT
if ($Disable) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Disabling MQTT for $ServiceName" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Info "Removing MQTT environment variables..."
    
    Set-MqttEnvironment -Enabled $false `
        -BrokerUrl "" `
        -ClientId "" `
        -TopicPrefix "" `
        -Username "" `
        -Password "" `
        -QoS 1
    
    Write-Success "MQTT environment removed."
    
    # Restart service to apply changes
    Write-Info "Restarting service to apply changes..."
    try {
        Restart-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 3
        
        $service = Get-Service -Name $ServiceName
        if ($service.Status -eq 'Running') {
            Write-Success "Service restarted successfully."
        } else {
            Write-Warning "Service status: $($service.Status)"
        }
    } catch {
        Write-Warning "Could not restart service: $_"
        Write-Host "Please restart the service manually: Restart-Service $ServiceName" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "MQTT Disabled Successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "To re-enable MQTT: .\Configure-MQTT-Service.ps1 -Enable" -ForegroundColor Gray
    Write-Host ""
    
    exit 0
}

# No action specified - show help
Write-Host ""
Write-Host "Configure-MQTT-Service.ps1" -ForegroundColor Cyan
Write-Host "Configures MQTT for ScaleCmdBridge Windows Service" -ForegroundColor Gray
Write-Host ""
Write-Host "Usage:" -ForegroundColor Yellow
Write-Host "  .\Configure-MQTT-Service.ps1 -Enable [options]  # Enable MQTT"
Write-Host "  .\Configure-MQTT-Service.ps1 -Disable           # Disable MQTT"
Write-Host "  .\Configure-MQTT-Service.ps1 -Status            # Show current config"
Write-Host ""
Write-Host "Options:" -ForegroundColor Yellow
Write-Host "  -BrokerUrl    MQTT broker URL (default: mqtt://localhost:1883)"
Write-Host "  -ClientId     Client ID (default: scaleit-bridge)"
Write-Host "  -TopicPrefix  Topic prefix (default: scaleit)"
Write-Host "  -Username     Authentication username (optional)"
Write-Host "  -Password     Authentication password (optional)"
Write-Host "  -QoS          Quality of Service 0-2 (default: 1)"
Write-Host "  -Quiet        Suppress output messages"
Write-Host ""
Write-Host "Examples:" -ForegroundColor Yellow
Write-Host "  # Enable with defaults (local Mosquitto broker)"
Write-Host "  .\Configure-MQTT-Service.ps1 -Enable"
Write-Host ""
Write-Host "  # Enable with custom broker"
Write-Host "  .\Configure-MQTT-Service.ps1 -Enable -BrokerUrl 'mqtt://192.168.1.100:1883'"
Write-Host ""
Write-Host "  # Enable with authentication"
Write-Host "  .\Configure-MQTT-Service.ps1 -Enable -Username 'user' -Password 'pass'"
Write-Host ""
