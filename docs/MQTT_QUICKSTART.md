# MQTT Quick Start Guide

## Installation

### New Installation
1. Run installer: `ScaleCmdBridge-Setup-x64-v0.1.5-feature-network-access-enhancement.exe`
2. **Check the "Install Mosquitto MQTT Broker" option** ✅
3. Complete installation
4. **Done!** Both Bridge and Mosquitto are running

### What Gets Installed
- **ScaleIT Bridge**: Windows Service listening on port 8080
- **Mosquitto MQTT Broker**: Windows Service listening on port 1883
- **Windows Firewall Rules**: Automatically configured
- **MQTT Variables**: Pre-configured in Bridge

## Testing MQTT

### From the Master Computer (where Bridge is installed):

#### Subscribe to all weight readings:
```powershell
# Using Docker (if you have it)
docker exec -it mosquitto mosquitto_sub -h localhost -t "scaleit/#" -v

# Or install mosquitto-clients and use:
mosquitto_sub -h localhost -t "scaleit/#" -v
```

#### Send a command via MQTT:
```powershell
# Using Docker
docker exec -it mosquitto mosquitto_pub -h localhost -t "scaleit/command/c320tcp" -m '{"device_id":"c320tcp","command":"readGross"}'

# Or with mosquitto_pub:
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" -m "{\"device_id\":\"c320tcp\",\"command\":\"readGross\"}"
```

### From Other Computers in Local Network:

Replace `localhost` with your master computer's IP (e.g., `192.168.1.50`):

```bash
# Subscribe to weight readings
mosquitto_sub -h 192.168.1.50 -t "scaleit/#" -v

# Send command
mosquitto_pub -h 192.168.1.50 -t "scaleit/command/c320tcp" -m '{"device_id":"c320tcp","command":"readGross"}'
```

## MQTT Topics

### Published by Bridge (subscribe to these):
- `scaleit/weight/{device_id}` - Weight readings
  ```json
  {
    "device_id": "c320tcp",
    "weight": 172.0,
    "unit": "kg",
    "timestamp": 1768322984,
    "is_stable": true
  }
  ```

### Subscribed by Bridge (publish to these):
- `scaleit/command/{device_id}` - Send commands
  ```json
  {
    "device_id": "c320tcp",
    "command": "readGross"
  }
  ```

## MQTT Clients for Other Devices

### Windows:
- **MQTT Explorer**: http://mqtt-explorer.com/ (GUI, easiest)
- **mosquitto-clients**: https://mosquitto.org/download/

### Linux/Mac:
```bash
sudo apt install mosquitto-clients  # Ubuntu/Debian
brew install mosquitto              # macOS
```

### Mobile:
- **Android**: IoT MQTT Panel
- **iOS**: MQTTool

### Programming:
- **Python**: `pip install paho-mqtt`
- **JavaScript/Node.js**: `npm install mqtt`
- **C#**: NuGet package `MQTTnet`

## Service Management

### Bridge Service:
```powershell
net start ScaleCmdBridge    # Start
net stop ScaleCmdBridge     # Stop
sc query ScaleCmdBridge     # Status
```

### Mosquitto Service:
```powershell
net start mosquitto         # Start
net stop mosquitto          # Stop
sc query mosquitto          # Status
```

## Troubleshooting

### Check if Mosquitto is running:
```powershell
sc query mosquitto
```

### Check if port 1883 is open:
```powershell
Test-NetConnection -ComputerName localhost -Port 1883
```

### View Mosquitto logs:
```
C:\Program Files\mosquitto\logs\mosquitto.log
```

### View Bridge logs:
```
C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log
```

### Firewall issues:
If MQTT doesn't work from other computers:
```powershell
# Run as Administrator
netsh advfirewall firewall add rule name="MQTT Broker - Port 1883" dir=in action=allow protocol=TCP localport=1883 profile=Private
```

## Integration Examples

### Home Assistant:
```yaml
mqtt:
  sensor:
    - name: "Scale Weight"
      state_topic: "scaleit/weight/c320tcp"
      unit_of_measurement: "kg"
      value_template: "{{ value_json.weight }}"
```

### Node-RED:
1. Add MQTT-in node
2. Server: `192.168.1.50:1883`
3. Topic: `scaleit/#`
4. Parse JSON payload

For more details, see [MQTT_INTEGRATION.md](MQTT_INTEGRATION.md)
