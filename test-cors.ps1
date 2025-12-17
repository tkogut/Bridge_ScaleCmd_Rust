# Test CORS Headers in Bridge Response
Write-Host "Testing CORS configuration..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Simple GET request
Write-Host "1. Testing GET /health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -Method GET -UseBasicParsing
    Write-Host "   Status: $($response.StatusCode) OK" -ForegroundColor Green
    Write-Host ""
    Write-Host "   CORS Headers found:" -ForegroundColor Cyan
    
    $corsHeaders = @()
    if ($response.Headers['Access-Control-Allow-Origin']) {
        $corsHeaders += "✓ Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])"
    } else {
        $corsHeaders += "✗ Access-Control-Allow-Origin: MISSING"
    }
    
    if ($response.Headers['Access-Control-Allow-Methods']) {
        $corsHeaders += "✓ Access-Control-Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])"
    } else {
        $corsHeaders += "✗ Access-Control-Allow-Methods: MISSING"
    }
    
    if ($response.Headers['Access-Control-Allow-Headers']) {
        $corsHeaders += "✓ Access-Control-Allow-Headers: $($response.Headers['Access-Control-Allow-Headers'])"
    } else {
        $corsHeaders += "✗ Access-Control-Allow-Headers: MISSING"
    }
    
    $corsHeaders | ForEach-Object { Write-Host "   $_" -ForegroundColor $(if ($_ -like "✓*") { "Green" } else { "Red" }) }
    
    Write-Host ""
    Write-Host "   All Headers:" -ForegroundColor Cyan
    $response.Headers.GetEnumerator() | Sort-Object Key | ForEach-Object {
        Write-Host "   $($_.Key): $($_.Value)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "   ERROR: Bridge is not running or not accessible" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Start Bridge with: .\run-backend.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "2. Testing OPTIONS request (CORS preflight)..." -ForegroundColor Yellow
try {
    $optionsResponse = Invoke-WebRequest -Uri "http://localhost:8080/health" -Method OPTIONS `
        -Headers @{
            "Origin" = "http://localhost:5173"
            "Access-Control-Request-Method" = "GET"
            "Access-Control-Request-Headers" = "Content-Type"
        } -UseBasicParsing
    
    Write-Host "   Status: $($optionsResponse.StatusCode) OK" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Preflight CORS Headers:" -ForegroundColor Cyan
    
    if ($optionsResponse.Headers['Access-Control-Allow-Origin']) {
        Write-Host "   ✓ Access-Control-Allow-Origin: $($optionsResponse.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Access-Control-Allow-Origin: MISSING" -ForegroundColor Red
    }
    
    if ($optionsResponse.Headers['Access-Control-Allow-Methods']) {
        Write-Host "   ✓ Access-Control-Allow-Methods: $($optionsResponse.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Access-Control-Allow-Methods: MISSING" -ForegroundColor Red
    }
    
    if ($optionsResponse.Headers['Access-Control-Max-Age']) {
        Write-Host "   ✓ Access-Control-Max-Age: $($optionsResponse.Headers['Access-Control-Max-Age'])" -ForegroundColor Green
    }
    
} catch {
    Write-Host "   ERROR: OPTIONS request failed" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "If you see '✓' for all CORS headers, configuration is correct!" -ForegroundColor Green
Write-Host "If you see '✗' for any header, Bridge needs to be rebuilt." -ForegroundColor Yellow

