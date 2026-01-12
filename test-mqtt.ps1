# Test MQTT Integration Script
# This script helps test MQTT integration with ScaleIT Bridge

Write-Host "========================================" -ForegroundColor Green
Write-Host "MQTT Integration Test Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Step 1: Check if Docker Desktop is running
Write-Host "Step 1: Checking Docker Desktop..." -ForegroundColor Yellow
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker Desktop is running" -ForegroundColor Green
    } else {
        Write-Host "✗ Docker Desktop is not running. Please start Docker Desktop first." -ForegroundColor Red
        Write-Host "  Start Docker Desktop and run this script again." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Docker Desktop is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Step 2: Start Mosquitto MQTT broker
Write-Host ""
Write-Host "Step 2: Starting Mosquitto MQTT broker..." -ForegroundColor Yellow
$mosquittoContainer = docker ps -a --filter "name=mosquitto" --format "{{.Names}}"
if ($mosquittoContainer -eq "mosquitto") {
    Write-Host "  Mosquitto container exists, starting it..." -ForegroundColor Cyan
    docker start mosquitto
} else {
    Write-Host "  Creating and starting Mosquitto container..." -ForegroundColor Cyan
    docker run -d --name mosquitto -p 1883:1883 -p 9001:9001 eclipse-mosquitto:latest
}

Start-Sleep -Seconds 3

# Check if Mosquitto is running
$mosquittoRunning = docker ps --filter "name=mosquitto" --format "{{.Names}}"
if ($mosquittoRunning -eq "mosquitto") {
    Write-Host "✓ Mosquitto MQTT broker is running on port 1883" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to start Mosquitto. Check Docker logs:" -ForegroundColor Red
    docker logs mosquitto
    exit 1
}

# Step 3: Check Bridge service status
Write-Host ""
Write-Host "Step 3: Checking ScaleIT Bridge service..." -ForegroundColor Yellow
$serviceStatus = sc query ScaleCmdBridge 2>&1 | Select-String "STATE"
if ($serviceStatus -match "RUNNING") {
    Write-Host "✓ ScaleIT Bridge service is running" -ForegroundColor Green
} else {
    Write-Host "✗ ScaleIT Bridge service is not running" -ForegroundColor Red
    Write-Host "  Starting service..." -ForegroundColor Yellow
    net start ScaleCmdBridge
    Start-Sleep -Seconds 3
}

# Step 4: Configure MQTT in Bridge service
Write-Host ""
Write-Host "Step 4: Configuring MQTT in Bridge service..." -ForegroundColor Yellow
$installDir = "C:\Program Files\ScaleCmdBridge"
if (Test-Path "$installDir\nssm.exe") {
    Write-Host "  Setting MQTT environment variables..." -ForegroundColor Cyan
    & "$installDir\nssm.exe" set ScaleCmdBridge AppEnvironmentExtra "MQTT_ENABLED=true MQTT_BROKER_URL=mqtt://localhost:1883 MQTT_TOPIC_PREFIX=scaleit"
    
    Write-Host "  Restarting service to apply changes..." -ForegroundColor Cyan
    net stop ScaleCmdBridge
    Start-Sleep -Seconds 2
    net start ScaleCmdBridge
    Start-Sleep -Seconds 3
    
    Write-Host "✓ MQTT configuration applied" -ForegroundColor Green
} else {
    Write-Host "✗ NSSM not found. Bridge may not be installed as service." -ForegroundColor Red
    Write-Host "  For manual configuration, set environment variables:" -ForegroundColor Yellow
    Write-Host "    MQTT_ENABLED=true" -ForegroundColor Cyan
    Write-Host "    MQTT_BROKER_URL=mqtt://localhost:1883" -ForegroundColor Cyan
    Write-Host "    MQTT_TOPIC_PREFIX=scaleit" -ForegroundColor Cyan
}

# Step 5: Check Bridge logs for MQTT initialization
Write-Host ""
Write-Host "Step 5: Checking Bridge logs for MQTT initialization..." -ForegroundColor Yellow
$logFile = "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log"
if (Test-Path $logFile) {
    $mqttLogs = Get-Content $logFile -Tail 50 | Select-String "MQTT"
    if ($mqttLogs) {
        Write-Host "  Recent MQTT logs:" -ForegroundColor Cyan
        $mqttLogs | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    } else {
        Write-Host "  No MQTT logs found yet. Service may still be starting..." -ForegroundColor Yellow
    }
} else {
    Write-Host "  Log file not found: $logFile" -ForegroundColor Yellow
}

# Step 6: Test MQTT connection
Write-Host ""
Write-Host "Step 6: Testing MQTT connection..." -ForegroundColor Yellow
Write-Host "  Testing connection to MQTT broker..." -ForegroundColor Cyan
$testConnection = Test-NetConnection -ComputerName localhost -Port 1883 -WarningAction SilentlyContinue
if ($testConnection.TcpTestSucceeded) {
    Write-Host "✓ MQTT broker is accessible on port 1883" -ForegroundColor Green
} else {
    Write-Host "✗ Cannot connect to MQTT broker on port 1883" -ForegroundColor Red
}

# Step 7: Instructions for testing
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Testing Instructions" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Subscribe to weight readings (in a new terminal):" -ForegroundColor Yellow
Write-Host "   mosquitto_sub -h localhost -t 'scaleit/weight/+'" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Subscribe to all topics (for debugging):" -ForegroundColor Yellow
Write-Host "   mosquitto_sub -h localhost -t 'scaleit/#' -v" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Execute a command via MQTT:" -ForegroundColor Yellow
$mqttCmd = "   mosquitto_pub -h localhost -t 'scaleit/command/C320' -m '{`"device_id`": `"C320`", `"command`": `"readGross`"}'"
Write-Host $mqttCmd -ForegroundColor Cyan
Write-Host "   (Replace 'C320' with your actual device_id)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Execute a command via HTTP API (will publish to MQTT):" -ForegroundColor Yellow
$httpCmd = "   Invoke-WebRequest -Uri 'http://localhost:8080/scalecmd' -Method POST -ContentType 'application/json' -Body '{`"device_id`": `"C320`", `"command`": `"readGross`"}'"
Write-Host $httpCmd -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Check Bridge logs:" -ForegroundColor Yellow
Write-Host "   Get-Content 'C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log' -Tail 50 | Select-String 'MQTT'" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
