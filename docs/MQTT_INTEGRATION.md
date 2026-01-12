# MQTT Integration Guide

Ten dokument opisuje integrację MQTT w ScaleIT Bridge, która umożliwia publikowanie odczytów masy oraz wykonywanie komend przez protokół MQTT.

## Przegląd

MQTT (Message Queuing Telemetry Transport) to lekki protokół komunikacji typu pub/sub, który umożliwia:
- **Publikowanie odczytów masy** z wag do brokerów MQTT
- **Wykonywanie komend** na wagach przez subskrypcję tematów MQTT
- **Integrację z systemami zewnętrznymi** (np. Home Assistant, Node-RED, inne systemy IoT)

## Konfiguracja

### Zmienne środowiskowe

MQTT jest konfigurowany przez zmienne środowiskowe:

| Zmienna | Opis | Domyślna wartość | Wymagane |
|---------|------|------------------|----------|
| `MQTT_ENABLED` | Włącza/wyłącza MQTT | `false` | Nie |
| `MQTT_BROKER_URL` | URL brokera MQTT | `mqtt://localhost:1883` | Tak (jeśli włączone) |
| `MQTT_CLIENT_ID` | Unikalny identyfikator klienta | `scaleit-bridge` | Nie |
| `MQTT_TOPIC_PREFIX` | Prefiks dla wszystkich tematów | `scaleit` | Nie |
| `MQTT_USERNAME` | Nazwa użytkownika (opcjonalnie) | - | Nie |
| `MQTT_PASSWORD` | Hasło (opcjonalnie) | - | Nie |
| `MQTT_QOS` | Quality of Service (0, 1, lub 2) | `1` | Nie |
| `MQTT_RETAIN` | Czy wiadomości mają być retainowane | `false` | Nie |

### Format URL brokera

Obsługiwane formaty:
- `mqtt://host:port` - standardowe połączenie MQTT
- `mqtts://host:port` - MQTT przez TLS/SSL
- `tcp://host:port` - alternatywny format
- `ssl://host:port` - alternatywny format SSL

Jeśli port nie jest podany, domyślnie używany jest port `1883` (lub `8883` dla SSL).

### Przykładowa konfiguracja

#### Podstawowa konfiguracja (lokalny broker)

```powershell
# Włącz MQTT
$env:MQTT_ENABLED="true"
$env:MQTT_BROKER_URL="mqtt://localhost:1883"
$env:MQTT_TOPIC_PREFIX="scaleit"
```

#### Konfiguracja z autentykacją

```powershell
$env:MQTT_ENABLED="true"
$env:MQTT_BROKER_URL="mqtt://broker.example.com:1883"
$env:MQTT_USERNAME="scaleit_user"
$env:MQTT_PASSWORD="secure_password"
$env:MQTT_CLIENT_ID="scaleit-bridge-001"
```

#### Konfiguracja z SSL/TLS

```powershell
$env:MQTT_ENABLED="true"
$env:MQTT_BROKER_URL="mqtts://broker.example.com:8883"
$env:MQTT_USERNAME="scaleit_user"
$env:MQTT_PASSWORD="secure_password"
```

#### Konfiguracja dla Windows Service

Jeśli Bridge działa jako Windows Service, użyj NSSM do ustawienia zmiennych środowiskowych:

```powershell
cd "C:\Program Files\ScaleCmdBridge"

# Ustaw zmienne środowiskowe
.\nssm.exe set ScaleCmdBridge AppEnvironmentExtra "MQTT_ENABLED=true MQTT_BROKER_URL=mqtt://localhost:1883 MQTT_TOPIC_PREFIX=scaleit"

# Restart service
net stop ScaleCmdBridge
net start ScaleCmdBridge
```

## Tematy MQTT

### Publikowane tematy (Bridge → Broker)

#### Odczyt masy
- **Temat:** `{topic_prefix}/weight/{device_id}`
- **Format:** JSON
- **Przykład:** `scaleit/weight/C320`

**Struktura wiadomości:**
```json
{
  "device_id": "C320",
  "weight": 42.5,
  "unit": "kg",
  "timestamp": 1704067200,
  "is_stable": true
}
```

#### Status urządzenia
- **Temat:** `{topic_prefix}/status/{device_id}`
- **Format:** JSON
- **Przykład:** `scaleit/status/C320`

**Struktura wiadomości:**
```json
{
  "device_id": "C320",
  "status": "connected",
  "timestamp": 1704067200
}
```

### Subskrybowane tematy (Broker → Bridge)

#### Komendy
- **Temat:** `{topic_prefix}/command/{device_id}`
- **Format:** JSON
- **Przykład:** `scaleit/command/C320`

**Struktura wiadomości:**
```json
{
  "device_id": "C320",
  "command": "readGross",
  "parameters": null
}
```

**Obsługiwane komendy:**
- `readGross` - odczyt masy brutto
- `readNet` - odczyt masy netto
- `tare` - tarowanie wagi
- `zero` - zerowanie wagi
- (inne komendy zdefiniowane w konfiguracji urządzenia)

**Odpowiedź:** Po wykonaniu komendy, Bridge automatycznie publikuje wynik do tematu `{topic_prefix}/weight/{device_id}`.

## Przykłady użycia

### Publikowanie odczytów masy

Bridge automatycznie publikuje odczyty masy do MQTT, gdy:
- Wykonana zostanie komenda przez API HTTP (`/scalecmd`)
- Wykonana zostanie komenda przez MQTT (`{topic_prefix}/command/{device_id}`)

### Wykonywanie komend przez MQTT

#### Przykład 1: Odczyt masy brutto

**Publikuj wiadomość do tematu:** `scaleit/command/C320`

```json
{
  "device_id": "C320",
  "command": "readGross"
}
```

**Odpowiedź zostanie opublikowana do:** `scaleit/weight/C320`

```json
{
  "device_id": "C320",
  "weight": 42.5,
  "unit": "kg",
  "timestamp": 1704067200,
  "is_stable": true
}
```

#### Przykład 2: Tarowanie wagi

**Publikuj wiadomość do tematu:** `scaleit/command/C320`

```json
{
  "device_id": "C320",
  "command": "tare"
}
```

### Integracja z Home Assistant

#### Konfiguracja w `configuration.yaml`:

```yaml
mqtt:
  sensor:
    - name: "Scale Weight"
      state_topic: "scaleit/weight/C320"
      value_template: "{{ value_json.weight }}"
      unit_of_measurement: "{{ value_json.unit }}"
      json_attributes_topic: "scaleit/weight/C320"
      json_attributes_template: "{{ value_json | tojson }}"
      
    - name: "Scale Stable"
      state_topic: "scaleit/weight/C320"
      value_template: "{{ value_json.is_stable }}"
      
  switch:
    - name: "Read Gross Weight"
      command_topic: "scaleit/command/C320"
      payload_on: '{"device_id": "C320", "command": "readGross"}'
      state_topic: "scaleit/weight/C320"
      value_template: "{{ value_json.weight }}"
```

### Integracja z Node-RED

#### Przykładowy flow:

1. **MQTT In Node** - subskrybuje `scaleit/weight/C320`
2. **Function Node** - przetwarza dane JSON
3. **Dashboard Node** - wyświetla odczyty

**Przykład Function Node:**
```javascript
const weight = msg.payload.weight;
const unit = msg.payload.unit;
const isStable = msg.payload.is_stable;

msg.payload = {
    weight: weight,
    unit: unit,
    isStable: isStable,
    timestamp: new Date(msg.payload.timestamp * 1000)
};

return msg;
```

**Wysyłanie komendy:**
- **MQTT Out Node** - publikuje do `scaleit/command/C320`
- **Payload:** `{"device_id": "C320", "command": "readGross"}`

## Obsługa błędów i reconnection

Bridge automatycznie obsługuje:
- **Reconnection logic** - automatyczne ponowne łączenie przy utracie połączenia
- **Exponential backoff** - opóźnienie między próbami połączenia zwiększa się wykładniczo (od 1s do 60s)
- **Graceful error handling** - błędy publikacji nie przerywają działania Bridge

### Logi

Sprawdź logi Bridge, aby monitorować status MQTT:

```powershell
# Logi stdout
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" | Select-String "MQTT"

# Logi stderr (błędy)
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" | Select-String "MQTT"
```

**Oczekiwane logi przy starcie:**
```
MQTT publisher initialized successfully
MQTT subscriber event loop started
MQTT subscriber connected successfully
```

**Logi błędów:**
```
MQTT publisher event loop error: Connection refused
MQTT subscriber event loop error: Connection timeout
```

## Bezpieczeństwo

### Rekomendacje

1. **Używaj autentykacji** - zawsze ustaw `MQTT_USERNAME` i `MQTT_PASSWORD`
2. **Używaj SSL/TLS** - dla produkcji użyj `mqtts://` zamiast `mqtt://`
3. **Unikalne Client ID** - ustaw unikalny `MQTT_CLIENT_ID` dla każdej instancji Bridge
4. **Firewall** - ogranicz dostęp do brokera MQTT tylko z zaufanych sieci
5. **ACL (Access Control List)** - skonfiguruj ACL na brokerze, aby ograniczyć dostęp do tematów

### Przykład bezpiecznej konfiguracji

```powershell
$env:MQTT_ENABLED="true"
$env:MQTT_BROKER_URL="mqtts://secure-broker.example.com:8883"
$env:MQTT_USERNAME="scaleit_bridge_user"
$env:MQTT_PASSWORD="strong_random_password"
$env:MQTT_CLIENT_ID="scaleit-bridge-prod-001"
$env:MQTT_QOS="2"  # Exactly once delivery
```

## Troubleshooting

### Problem: MQTT nie publikuje wiadomości

**Sprawdź:**
1. Czy `MQTT_ENABLED=true` jest ustawione
2. Czy broker MQTT jest dostępny (`ping broker_host`)
3. Czy port jest otwarty (`Test-NetConnection -ComputerName broker_host -Port 1883`)
4. Czy autentykacja jest poprawna (jeśli wymagana)
5. Czy logi pokazują błędy połączenia

**Rozwiązanie:**
```powershell
# Test połączenia do brokera
Test-NetConnection -ComputerName localhost -Port 1883

# Sprawdź logi
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 20
```

### Problem: Komendy MQTT nie są wykonywane

**Sprawdź:**
1. Czy subscriber event loop został uruchomiony (sprawdź logi)
2. Czy temat komendy jest poprawny (`{topic_prefix}/command/{device_id}`)
3. Czy format JSON jest poprawny
4. Czy `device_id` istnieje w konfiguracji Bridge

**Rozwiązanie:**
```powershell
# Sprawdź czy urządzenie jest skonfigurowane
Get-Content "C:\ProgramData\ScaleCmdBridge\config\devices.json"

# Sprawdź logi wykonania komend
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" | Select-String "MQTT command"
```

### Problem: Błędy reconnection

**Sprawdź:**
1. Czy broker MQTT jest stabilny
2. Czy sieć jest stabilna
3. Czy firewall nie blokuje połączeń

**Rozwiązanie:**
- Bridge automatycznie próbuje ponownie połączyć się z brokerem
- Sprawdź logi, aby zobaczyć częstotliwość prób reconnection
- Jeśli problemy się utrzymują, sprawdź konfigurację brokera MQTT

## Testowanie

### Test publikacji odczytów

1. **Włącz MQTT** w Bridge
2. **Subskrybuj temat** na brokerze:
   ```bash
   mosquitto_sub -h localhost -t "scaleit/weight/+"
   ```
3. **Wykonaj komendę** przez API HTTP lub UI
4. **Sprawdź** czy wiadomość pojawiła się w subskrypcji

### Test wykonywania komend

1. **Włącz MQTT** w Bridge
2. **Opublikuj komendę** do tematu:
   ```bash
   mosquitto_pub -h localhost -t "scaleit/command/C320" -m '{"device_id": "C320", "command": "readGross"}'
   ```
3. **Sprawdź** czy odpowiedź została opublikowana do `scaleit/weight/C320`

## Dokumentacja dodatkowa

- [README.md](../README.md) - Ogólna dokumentacja projektu
- [LOCAL_NETWORK_ACCESS.md](./LOCAL_NETWORK_ACCESS.md) - Konfiguracja dostępu sieciowego
- [SWAGGER_API_DOCUMENTATION.md](./SWAGGER_API_DOCUMENTATION.md) - Dokumentacja API HTTP

## Wsparcie

Jeśli napotkasz problemy:
1. Sprawdź sekcję "Troubleshooting" powyżej
2. Sprawdź logi Bridge
3. Sprawdź logi brokera MQTT
4. Sprawdź dokumentację brokera MQTT (np. Mosquitto, EMQX, HiveMQ)
