# Simple MQTT Test Script
# This script sets up MQTT testing environment

Write-Host "========================================" -ForegroundColor Green
Write-Host "Simple MQTT Test Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Step 1: Start Mosquitto with Docker
Write-Host ""
Write-Host "Step 1: Starting Mosquitto MQTT Broker with Docker..." -ForegroundColor Yellow
docker run -d --name mosquitto-test -p 1883:1883 --rm eclipse-mosquitto:latest
Start-Sleep -Seconds 3

# Check if Mosquitto is running
$containerRunning = docker ps --filter "name=mosquitto-test" --format "{{.Names}}"
if ($containerRunning -eq "mosquitto-test") {
    Write-Host "✓ Mosquitto is running on port 1883" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to start Mosquitto" -ForegroundColor Red
    exit 1
}

# Step 2: Start ScaleIT Bridge with MQTT enabled
Write-Host ""
Write-Host "Step 2: Starting ScaleIT Bridge with MQTT enabled..." -ForegroundColor Yellow

# Set environment variables for MQTT
$env:MQTT_ENABLED = "true"
$env:MQTT_BROKER_URL = "mqtt://localhost:1883"
$env:MQTT_CLIENT_ID = "scaleit-bridge"
$env:MQTT_TOPIC_PREFIX = "scaleit"

Write-Host "Environment variables set:" -ForegroundColor Cyan
Write-Host "  MQTT_ENABLED=true" -ForegroundColor White
Write-Host "  MQTT_BROKER_URL=mqtt://localhost:1883" -ForegroundColor White
Write-Host "  MQTT_CLIENT_ID=scaleit-bridge" -ForegroundColor White
Write-Host "  MQTT_TOPIC_PREFIX=scaleit" -ForegroundColor White

# Start the bridge
Write-Host ""
Write-Host "Starting ScaleIT Bridge..." -ForegroundColor Cyan
& ".\src-rust\target\release\scaleit-bridge.exe"

# Cleanup on exit
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Yellow
docker stop mosquitto-test
docker rm mosquitto-test

Write-Host "Test completed." -ForegroundColor Green