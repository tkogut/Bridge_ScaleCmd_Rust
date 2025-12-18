# Test readgross command
$deviceId = "c320tcp"
$command = "readgross"

Write-Host "Testing readgross command..." -ForegroundColor Yellow
Write-Host "Device ID: $deviceId" -ForegroundColor Cyan
Write-Host "Command: $command" -ForegroundColor Cyan
Write-Host ""

$body = @{
    device_id = $deviceId
    command = $command
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/scalecmd" -Method POST -Body $body -ContentType "application/json"
    Write-Host "Success!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Error!" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}

