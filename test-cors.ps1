# Test CORS Headers in Bridge Response
Write-Host "Testing CORS configuration..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Simple GET request with Origin header (like browser does)
Write-Host "1. Testing GET /health with Origin header..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -Method GET `
        -Headers @{"Origin" = "http://localhost:5173"} -UseBasicParsing
    Write-Host "   Status: $($response.StatusCode) OK" -ForegroundColor Green
    Write-Host ""
    Write-Host "   CORS Headers found:" -ForegroundColor Cyan
    
    $corsHeaders = @()
    if ($response.Headers['Access-Control-Allow-Origin']) {
        $corsHeaders += "[OK] Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])"
    } else {
        $corsHeaders += "[MISSING] Access-Control-Allow-Origin: MISSING"
    }
    
    if ($response.Headers['Access-Control-Allow-Methods']) {
        $corsHeaders += "[OK] Access-Control-Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])"
    } else {
        $corsHeaders += "[MISSING] Access-Control-Allow-Methods: MISSING"
    }
    
    if ($response.Headers['Access-Control-Allow-Headers']) {
        $corsHeaders += "[OK] Access-Control-Allow-Headers: $($response.Headers['Access-Control-Allow-Headers'])"
    } else {
        $corsHeaders += "[MISSING] Access-Control-Allow-Headers: MISSING"
    }
    
    $corsHeaders | ForEach-Object { 
        $color = if ($_ -like "[OK]*") { "Green" } else { "Red" }
        Write-Host "   $_" -ForegroundColor $color
    }
    
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
        Write-Host "   [OK] Access-Control-Allow-Origin: $($optionsResponse.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    } else {
        Write-Host "   [MISSING] Access-Control-Allow-Origin: MISSING" -ForegroundColor Red
    }
    
    if ($optionsResponse.Headers['Access-Control-Allow-Methods']) {
        Write-Host "   [OK] Access-Control-Allow-Methods: $($optionsResponse.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Green
    } else {
        Write-Host "   [MISSING] Access-Control-Allow-Methods: MISSING" -ForegroundColor Red
    }
    
    if ($optionsResponse.Headers['Access-Control-Max-Age']) {
        Write-Host "   [OK] Access-Control-Max-Age: $($optionsResponse.Headers['Access-Control-Max-Age'])" -ForegroundColor Green
    }
    
} catch {
    Write-Host "   ERROR: OPTIONS request failed" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "CORS is working correctly if:" -ForegroundColor Green
Write-Host "  - Access-Control-Allow-Origin is present in GET request" -ForegroundColor White
Write-Host "  - All CORS headers are present in OPTIONS (preflight) request" -ForegroundColor White
Write-Host ""
Write-Host "Note: Access-Control-Allow-Methods and Allow-Headers" -ForegroundColor Gray
Write-Host "are only sent in OPTIONS responses (per CORS spec)" -ForegroundColor Gray
Write-Host "This is normal and correct behavior!" -ForegroundColor Green

