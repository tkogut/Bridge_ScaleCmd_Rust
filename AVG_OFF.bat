# ========================================
# Rust Build with AVG Control
# ========================================

Write-Host "Stopping AVG services..." -ForegroundColor Yellow

# Stop AVG services
@("AVGIDSAgent", "AVG Antivirus Service", "avgwd", "avgsvc") | ForEach-Object {
    try {
        net stop $_ /y 2>$null
    } catch {}
}

Start-Sleep -Seconds 2

Write-Host "Building Rust project..." -ForegroundColor Yellow

# Setup environment
$env:RUSTUP_HOME = "C:\Users\tkogut\.rustup"
$env:CARGO_HOME = "C:\Users\tkogut\.cargo"
$env:PATH = "C:\Users\tkogut\.cargo\bin;D:\msys64\mingw64\bin;D:\msys64\usr\bin;$env:PATH"

# Build
cd C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust\src-rust
cargo clean
cargo build --target x86_64-pc-windows-gnu --release

$buildResult = $LASTEXITCODE

# Restart AVG
Write-Host "Restarting AVG services..." -ForegroundColor Yellow
@("avgsvc", "AVG Antivirus Service") | ForEach-Object {
    try {
        net start $_ /y 2>$null
    } catch {}
}

# Result
if ($buildResult -eq 0) {
    Write-Host "✓ BUILD SUCCESS!" -ForegroundColor Green
    Write-Host "Binary: C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust\src-rust\target\x86_64-pc-windows-gnu\release\scaleit-bridge.exe"
} else {
    Write-Host "✗ BUILD FAILED" -ForegroundColor Red
}
