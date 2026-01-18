# Set location to project root explicitly
Set-Location "C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust"

. .\Setup-MinGW.ps1
cd src-rust

$env:RUST_BACKTRACE = "1"
$env:CARGO_TERM_COLOR = "never"

Write-Host "Running all tests..."
# Redirecting to out.txt to be safe with encoding/formatting, 
# although now that I fixed compilation errors, output should be standard test output.
cmd /c "cargo +stable-x86_64-pc-windows-gnu test -- --nocapture > out.txt 2>&1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "TESTS FAILED!"
    cmd /c "type out.txt"
    exit 1
}

Write-Host "TESTS PASSED!"
cmd /c "type out.txt"
