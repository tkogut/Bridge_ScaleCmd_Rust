#!/usr/bin/env pwsh
# Script to serve Swagger/OpenAPI documentation locally

param(
    [string]$Port = "3000",
    [string]$File = "swagger.yaml"
)

Write-Host "🌐 Starting Swagger UI server..." -ForegroundColor Cyan
Write-Host "📄 File: $File" -ForegroundColor Gray
Write-Host "🔌 Port: $Port" -ForegroundColor Gray
Write-Host ""

# Check if file exists
if (-not (Test-Path $File)) {
    Write-Host "❌ Error: File '$File' not found!" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the project root directory." -ForegroundColor Yellow
    exit 1
}

# Try to use swagger-ui-serve if available
$swaggerUiServe = Get-Command swagger-ui-serve -ErrorAction SilentlyContinue

if ($swaggerUiServe) {
    Write-Host "✅ Using swagger-ui-serve..." -ForegroundColor Green
    Write-Host "📖 Opening browser at http://localhost:$Port" -ForegroundColor Cyan
    Write-Host ""
    swagger-ui-serve $File -p $Port
} else {
    Write-Host "⚠️  swagger-ui-serve not found. Trying npx..." -ForegroundColor Yellow
    
    # Try using npx (no global install needed)
    $npx = Get-Command npx -ErrorAction SilentlyContinue
    if ($npx) {
        Write-Host "✅ Using npx swagger-ui-serve..." -ForegroundColor Green
        Write-Host "📖 Opening browser at http://localhost:$Port" -ForegroundColor Cyan
        Write-Host ""
        npx -y swagger-ui-serve@latest $File -p $Port
    } else {
        Write-Host "❌ Error: Neither swagger-ui-serve nor npx found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Installation options:" -ForegroundColor Yellow
        Write-Host "  1. Global install: npm install -g swagger-ui-serve" -ForegroundColor Gray
        Write-Host "  2. Use npx (no install): npx swagger-ui-serve swagger.yaml" -ForegroundColor Gray
        Write-Host "  3. Use online editor: https://editor.swagger.io/" -ForegroundColor Gray
        exit 1
    }
}

