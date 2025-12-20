#!/usr/bin/env pwsh
# Script to serve Swagger/OpenAPI documentation locally

param(
    [string]$Port = "3000",
    [string]$File = "swagger.yaml"
)

Write-Host "Starting Swagger UI server..." -ForegroundColor Cyan
Write-Host "File: $File" -ForegroundColor Gray
Write-Host "Port: $Port" -ForegroundColor Gray
Write-Host ""

# Check if file exists
if (-not (Test-Path $File)) {
    Write-Host "Error: File '$File' not found!" -ForegroundColor Red
    Write-Host "Make sure you are running this from the project root directory." -ForegroundColor Yellow
    exit 1
}

# Check if swagger-ui.html exists, if not create it
if (-not (Test-Path "swagger-ui.html")) {
    Write-Host "Creating swagger-ui.html..." -ForegroundColor Yellow
    # HTML file should already exist, but if not, we'll use http-server
}

# Try to use http-server (simpler and more reliable)
$httpServer = Get-Command http-server -ErrorAction SilentlyContinue
$npx = Get-Command npx -ErrorAction SilentlyContinue

if ($httpServer) {
    Write-Host "Using http-server..." -ForegroundColor Green
    Write-Host "Opening browser at http://localhost:$Port/swagger-ui.html" -ForegroundColor Cyan
    Write-Host ""
    Start-Process "http://localhost:$Port/swagger-ui.html"
    http-server -p $Port -c-1
} elseif ($npx) {
    Write-Host "Using npx http-server..." -ForegroundColor Green
    Write-Host "Opening browser at http://localhost:$Port/swagger-ui.html" -ForegroundColor Cyan
    Write-Host ""
    Start-Process "http://localhost:$Port/swagger-ui.html"
    npx -y http-server@latest -p $Port -c-1
} else {
    Write-Host "Error: Neither http-server nor npx found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installation options:" -ForegroundColor Yellow
    Write-Host "  1. Global install: npm install -g http-server" -ForegroundColor Gray
    Write-Host "  2. Use npx (no install): npx http-server -p 3000" -ForegroundColor Gray
    Write-Host "  3. Use online editor: https://editor.swagger.io/" -ForegroundColor Gray
    Write-Host "  4. Open swagger-ui.html directly in browser (file://)" -ForegroundColor Gray
    exit 1
}
