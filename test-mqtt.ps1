Write-Host "========================================" -ForegroundColor Green
Write-Host "MQTT Integration Quick Check" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Step 1: Verify Docker Desktop" -ForegroundColor Yellow
try {
    docker info > $null 2>&1
    Write-Host "  Docker Desktop is running" -ForegroundColor Green
} catch {
    Write-Host "  Docker Desktop is not reachable. Start it before running this script." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Ensure Mosquitto MQTT broker is running" -ForegroundColor Yellow
$mosq = docker ps -a --filter "name=mosquitto" --format "{{.Names}}"
if ($mosq -eq "mosquitto") {
    Write-Host "  Starting existing Mosquitto container" -ForegroundColor Cyan
    docker start mosquitto | Out-Null
} else {
    Write-Host "  Creating Mosquitto container" -ForegroundColor Cyan
    docker run -d --name mosquitto -p 1883:1883 -p 9001:9001 eclipse-mosquitto:latest | Out-Null
}

Start-Sleep -Seconds 3
if ((docker ps --filter "name=mosquitto" --format "{{.Names}}") -ne "mosquitto") {
    Write-Host "  Mosquitto broker failed to start. Run 'docker logs mosquitto' for more details." -ForegroundColor Red
    exit 1
}
Write-Host "  Mosquitto is accepting connections on port 1883" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Check ScaleIT Bridge service status" -ForegroundColor Yellow
$serviceState = sc query ScaleCmdBridge | Select-String "STATE"
if ($serviceState -match "RUNNING") {
    Write-Host "  ScaleIT Bridge service is running" -ForegroundColor Green
} else {
    Write-Host "  Service is not running; attempting to start it" -ForegroundColor Yellow
    net start ScaleCmdBridge | Out-Null
    Start-Sleep -Seconds 3
    if (-not (sc query ScaleCmdBridge | Select-String "RUNNING")) {
        Write-Host "  Unable to start ScaleIT Bridge service" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Service started successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 4: Inspect recent MQTT log entries" -ForegroundColor Yellow
$logFile = "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log"
if (Test-Path $logFile) {
    $mqttEntries = Get-Content $logFile -Tail 40 | Select-String "MQTT"
    if ($mqttEntries) {
        Write-Host "  MQTT entries found in logs:" -ForegroundColor Green
        $mqttEntries | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    } else {
        Write-Host "  No MQTT entries found in the last 40 lines; wait a moment and retry." -ForegroundColor Yellow
    }
} else {
    Write-Host "  Log file is not present yet: $logFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 5: Use these commands in separate terminals to validate MQTT traffic" -ForegroundColor Green
Write-Host "  Subscribe to weight readings:" -ForegroundColor Yellow
Write-Host "    mosquitto_sub -h localhost -t 'scaleit/weight/+'" -ForegroundColor Cyan
Write-Host "  Publish a command via MQTT:" -ForegroundColor Yellow
Write-Host "    mosquitto_pub -h localhost -t 'scaleit/command/C320' -m '{\"device_id\": \"C320\", \"command\": \"readGross\"}'" -ForegroundColor Cyan
Write-Host ""
Write-Host "  After sending commands, re-run Step 4 to confirm MQTT log activity." -ForegroundColor Green
