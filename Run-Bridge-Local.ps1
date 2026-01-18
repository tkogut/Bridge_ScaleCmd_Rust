# Set location to project root explicitly
Set-Location "C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust"

. .\Setup-MinGW.ps1
cd src-rust

$env:RUST_BACKTRACE = "1"
$env:RUST_LOG = "info,scaleit_bridge=debug"
$env:PORT = "8081"
$env:MQTT_ENABLED = "true"
$env:MQTT_BROKER_URL = "mqtt://127.0.0.1:1883"
$env:MQTT_CLIENT_ID = "scaleit_bridge_test"
$env:MQTT_TOPIC_PREFIX = "scaleit/bridge"



Write-Host "Starting Bridge Application..."
cargo +stable-x86_64-pc-windows-gnu run
