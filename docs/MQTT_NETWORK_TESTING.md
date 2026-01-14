# MQTT Network Testing Guide

Ten dokument zawiera kompleksowe instrukcje testowania funkcjonalności MQTT w ScaleIT Bridge, obejmujące testy jednostkowe, integracyjne i E2E dla komunikacji MQTT w sieci lokalnej.

## Przegląd

### Cel testów

MQTT testing obejmuje weryfikację:
- Publikowania odczytów masy do brokera MQTT
- Subskrypcji i wykonywania komend przez MQTT
- Reconnection logic przy utracie połączenia
- Integracji z systemami zewnętrznymi (Home Assistant, Node-RED)
- Dostępu z sieci lokalnej (LAN)

### Architektura testowa

```
┌─────────────────────────────────────────────────────────────────┐
│                        Test Environment                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐   │
│  │   ScaleIT   │────▶│   Mosquitto  │◀────│   Test Client   │   │
│  │   Bridge    │     │    Broker    │     │  (subscriber)   │   │
│  └─────────────┘     └──────────────┘     └─────────────────┘   │
│         │                    │                     │             │
│         │                    │                     │             │
│         ▼                    ▼                     ▼             │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐   │
│  │   Device    │     │    Topics    │     │  Command        │   │
│  │   Manager   │     │  scaleit/#   │     │  Publisher      │   │
│  └─────────────┘     └──────────────┘     └─────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Wymagania

### Software

| Komponent | Wersja | Opis |
|-----------|--------|------|
| Mosquitto | 2.0+ | MQTT Broker |
| mosquitto-clients | 2.0+ | mosquitto_pub, mosquitto_sub |
| PowerShell | 5.1+ | Scripting |
| Node.js | 18+ | Opcjonalnie - dla testów JS |
| Python | 3.8+ | Opcjonalnie - dla testów Python |

### Instalacja narzędzi testowych

#### Windows (z instalatorem ScaleIT Bridge)

```powershell
# Mosquitto jest instalowany automatycznie z Bridge (opcja w instalatorze)
# Po instalacji sprawdź:
sc query mosquitto
mosquitto_sub --help
```

#### Windows (ręczna instalacja)

```powershell
# Pobierz i zainstaluj Mosquitto
# https://mosquitto.org/download/

# Lub użyj skryptu z projektu:
.\scripts\Install-Mosquitto.ps1
```

#### Linux/macOS

```bash
# Ubuntu/Debian
sudo apt install mosquitto mosquitto-clients

# macOS
brew install mosquitto
```

## Konfiguracja środowiska testowego

### Zmienne środowiskowe

```powershell
# Podstawowa konfiguracja MQTT dla testów
$env:MQTT_ENABLED="true"
$env:MQTT_BROKER_URL="mqtt://localhost:1883"
$env:MQTT_CLIENT_ID="scaleit-bridge-test"
$env:MQTT_TOPIC_PREFIX="scaleit"
$env:MQTT_QOS="1"
$env:MQTT_RETAIN="false"
```

### Konfiguracja Mosquitto Broker

#### Podstawowa konfiguracja (bez auth) - `/etc/mosquitto/mosquitto.conf`:

```conf
# Listener configuration
listener 1883
allow_anonymous true

# Logging
log_dest file /var/log/mosquitto/mosquitto.log
log_type all

# Persistence
persistence true
persistence_location /var/lib/mosquitto/
```

#### Konfiguracja z autentykacją:

```conf
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd

# TLS (opcjonalnie)
# listener 8883
# cafile /etc/mosquitto/certs/ca.crt
# certfile /etc/mosquitto/certs/server.crt
# keyfile /etc/mosquitto/certs/server.key
```

### Uruchomienie środowiska testowego

#### Opcja 1: Lokalne usługi (Windows)

```powershell
# Start Mosquitto
net start mosquitto

# Start ScaleIT Bridge z MQTT
$env:MQTT_ENABLED="true"
$env:MQTT_BROKER_URL="mqtt://localhost:1883"
net start ScaleCmdBridge
```

#### Opcja 2: Docker Compose

```bash
# Start all services
docker-compose up -d mosquitto scaleit-bridge
```

---

## Testy manualne

### Test 1: Weryfikacja połączenia z brokerem

#### Cel
Sprawdzenie czy Bridge może połączyć się z MQTT Broker.

#### Procedura

```powershell
# 1. Sprawdź czy broker jest uruchomiony
Test-NetConnection -ComputerName localhost -Port 1883
# Oczekiwany wynik: TcpTestSucceeded: True

# 2. Sprawdź logi Bridge
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" -Tail 20 | Select-String "MQTT"

# Oczekiwane logi:
# MQTT publisher connected successfully
# MQTT subscriber connected successfully
```

#### Kryteria sukcesu
- [ ] Połączenie TCP do portu 1883 udane
- [ ] Logi pokazują "MQTT publisher connected successfully"
- [ ] Logi pokazują "MQTT subscriber connected successfully"

---

### Test 2: Publikowanie odczytów masy

#### Cel
Weryfikacja czy Bridge publikuje odczyty masy do MQTT.

#### Procedura

```powershell
# Terminal 1: Subskrybuj tematy
mosquitto_sub -h localhost -t "scaleit/#" -v

# Terminal 2: Wykonaj komendę przez API HTTP
$body = @{
    device_id = "c320tcp"
    command = "readGross"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8080/scalecmd" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

#### Oczekiwany wynik w Terminal 1

```
scaleit/weight/c320tcp {"device_id":"c320tcp","weight":42.5,"unit":"kg","timestamp":1704067200,"is_stable":true}
```

#### Kryteria sukcesu
- [ ] Wiadomość pojawia się na temacie `scaleit/weight/{device_id}`
- [ ] Format JSON jest poprawny
- [ ] Wszystkie pola są obecne (device_id, weight, unit, timestamp, is_stable)

---

### Test 3: Wykonywanie komend przez MQTT

#### Cel
Weryfikacja czy Bridge odpowiada na komendy wysłane przez MQTT.

#### Procedura

```powershell
# Terminal 1: Subskrybuj odpowiedzi
mosquitto_sub -h localhost -t "scaleit/weight/+" -v

# Terminal 2: Wyślij komendę przez MQTT
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'
```

#### Oczekiwany wynik w Terminal 1

```
scaleit/weight/c320tcp {"device_id":"c320tcp","weight":42.5,"unit":"kg","timestamp":1704067200,"is_stable":true}
```

#### Kryteria sukcesu
- [ ] Komenda została odebrana przez Bridge (sprawdź logi)
- [ ] Odpowiedź została opublikowana do `scaleit/weight/c320tcp`
- [ ] Format odpowiedzi jest poprawny

---

### Test 4: Status urządzenia

#### Cel
Weryfikacja publikowania statusu urządzenia.

#### Procedura

```powershell
# Subskrybuj tematy statusu
mosquitto_sub -h localhost -t "scaleit/status/+" -v

# Wykonaj komendę aby wyzwolić status update
# (lub poczekaj na automatyczny heartbeat jeśli zaimplementowany)
```

#### Oczekiwany format

```json
{
  "device_id": "c320tcp",
  "status": "connected",
  "timestamp": 1704067200
}
```

---

### Test 5: QoS (Quality of Service)

#### Cel
Weryfikacja różnych poziomów QoS.

#### Procedura

```powershell
# Test QoS 0 (At most once)
$env:MQTT_QOS="0"
# Restart Bridge i powtórz Test 2

# Test QoS 1 (At least once) - domyślny
$env:MQTT_QOS="1"
# Restart Bridge i powtórz Test 2

# Test QoS 2 (Exactly once)
$env:MQTT_QOS="2"
# Restart Bridge i powtórz Test 2
```

#### Kryteria sukcesu
- [ ] QoS 0: Wiadomości są dostarczane (bez potwierdzenia)
- [ ] QoS 1: Wiadomości są dostarczane co najmniej raz
- [ ] QoS 2: Wiadomości są dostarczane dokładnie raz

---

### Test 6: Retain flag

#### Cel
Weryfikacja zachowania retained messages.

#### Procedura

```powershell
# Włącz retain
$env:MQTT_RETAIN="true"
# Restart Bridge

# Wykonaj komendę
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'

# Poczekaj chwilę, potem subskrybuj
mosquitto_sub -h localhost -t "scaleit/weight/c320tcp" -v

# Powinieneś natychmiast otrzymać ostatnią wiadomość (retained)
```

#### Kryteria sukcesu
- [ ] Z `MQTT_RETAIN=true`: Nowy subscriber otrzymuje ostatnią wiadomość natychmiast
- [ ] Z `MQTT_RETAIN=false`: Nowy subscriber czeka na nowe wiadomości

---

## Testy sieciowe (LAN)

### Test 7: Dostęp MQTT z innego komputera

#### Cel
Weryfikacja dostępu do MQTT z sieci lokalnej.

#### Setup

- **Master (Bridge + Mosquitto)**: 192.168.1.100
- **Client**: 192.168.1.75

#### Procedura na Master

```powershell
# 1. Sprawdź czy Mosquitto nasłuchuje na wszystkich interfejsach
netstat -ano | findstr :1883
# Powinno pokazać: 0.0.0.0:1883 (nie tylko 127.0.0.1)

# 2. Sprawdź regułę firewall
netsh advfirewall firewall show rule name="MQTT Broker - Port 1883"

# 3. Jeśli reguła nie istnieje, dodaj ją:
netsh advfirewall firewall add rule name="MQTT Broker - Port 1883" `
    dir=in action=allow protocol=TCP localport=1883 profile=Private
```

#### Procedura na Client

```powershell
# 1. Test połączenia
Test-NetConnection -ComputerName 192.168.1.100 -Port 1883
# Oczekiwany wynik: TcpTestSucceeded: True

# 2. Subskrybuj z Client
mosquitto_sub -h 192.168.1.100 -t "scaleit/#" -v

# 3. Wyślij komendę z Client
mosquitto_pub -h 192.168.1.100 -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'
```

#### Kryteria sukcesu
- [ ] Połączenie TCP do Master:1883 z Client udane
- [ ] Subskrypcja z Client działa
- [ ] Komendy wysłane z Client są wykonywane przez Bridge
- [ ] Odpowiedzi są widoczne na Client

---

### Test 8: Multi-client subscription

#### Cel
Weryfikacja że wielu klientów może subskrybować tematy.

#### Procedura

```powershell
# Client 1 (Terminal 1)
mosquitto_sub -h 192.168.1.100 -t "scaleit/#" -v

# Client 2 (Terminal 2) - na innym komputerze lub drugim terminalu
mosquitto_sub -h 192.168.1.100 -t "scaleit/weight/+" -v

# Master - wyślij komendę
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'
```

#### Kryteria sukcesu
- [ ] Oba klienty otrzymują wiadomości
- [ ] Brak duplikatów na poszczególnych klientach
- [ ] Wiadomości są dostarczane w rozsądnym czasie (<100ms)

---

## Testy reconnection i error handling

### Test 9: Reconnection po utracie połączenia

#### Cel
Weryfikacja automatycznego ponownego łączenia.

#### Procedura

```powershell
# 1. Uruchom Bridge z MQTT
$env:MQTT_ENABLED="true"
net start ScaleCmdBridge

# 2. Sprawdź połączenie
mosquitto_sub -h localhost -t "scaleit/#" -v

# 3. Zatrzymaj Mosquitto (symulacja awarii)
net stop mosquitto

# 4. Sprawdź logi Bridge
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 10
# Powinny pojawić się błędy reconnection

# 5. Uruchom Mosquitto ponownie
net start mosquitto

# 6. Sprawdź czy Bridge się połączył (po exponential backoff)
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" -Tail 10 | Select-String "MQTT"
# Powinno pokazać: "MQTT publisher connected successfully"

# 7. Zweryfikuj działanie
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'
```

#### Kryteria sukcesu
- [ ] Bridge wykrywa utratę połączenia
- [ ] Logi pokazują błędy reconnection
- [ ] Bridge ponownie łączy się po uruchomieniu brokera
- [ ] Funkcjonalność jest przywrócona bez restartu Bridge
- [ ] Exponential backoff działa (opóźnienia rosną: 1s, 2s, 4s, ..., max 60s)

---

### Test 10: Broker niedostępny przy starcie

#### Cel
Weryfikacja zachowania gdy broker nie jest dostępny przy starcie Bridge.

#### Procedura

```powershell
# 1. Zatrzymaj Mosquitto
net stop mosquitto

# 2. Uruchom Bridge
$env:MQTT_ENABLED="true"
net start ScaleCmdBridge

# 3. Sprawdź logi - Bridge powinien działać mimo braku MQTT
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 10

# 4. Sprawdź czy API HTTP działa (MQTT failure nie powinien blokować)
Invoke-WebRequest http://localhost:8080/health

# 5. Uruchom Mosquitto
net start mosquitto

# 6. Zaczekaj na reconnection i przetestuj
Start-Sleep -Seconds 10
mosquitto_sub -h localhost -t "scaleit/#" -v &
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'
```

#### Kryteria sukcesu
- [ ] Bridge startuje pomimo niedostępnego brokera
- [ ] API HTTP działa normalnie
- [ ] Bridge automatycznie łączy się gdy broker staje się dostępny
- [ ] Brak crash-ów lub panic-ów

---

### Test 11: Invalid broker URL

#### Cel
Weryfikacja obsługi nieprawidłowego URL brokera.

#### Procedura

```powershell
# Test z nieprawidłowym URL
$env:MQTT_BROKER_URL="mqtt://invalid-host:9999"
$env:MQTT_ENABLED="true"
net restart ScaleCmdBridge

# Sprawdź logi
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 10
# Powinny być błędy połączenia, ale Bridge powinien działać
```

#### Kryteria sukcesu
- [ ] Bridge loguje błędy połączenia
- [ ] Bridge nie crash-uje
- [ ] API HTTP nadal działa

---

## Testy wydajnościowe

### Test 12: High-frequency publishing

#### Cel
Weryfikacja wydajności przy wysokiej częstotliwości publikacji.

#### Procedura

```powershell
# Terminal 1: Subskrybuj i zliczaj
$count = 0
mosquitto_sub -h localhost -t "scaleit/weight/+" -C 100 | ForEach-Object { $count++; Write-Host "Received: $count" }

# Terminal 2: Wysyłaj komendy w pętli
for ($i = 1; $i -le 100; $i++) {
    $body = @{ device_id = "c320tcp"; command = "readGross" } | ConvertTo-Json
    Invoke-WebRequest -Uri "http://localhost:8080/scalecmd" -Method POST -ContentType "application/json" -Body $body | Out-Null
    Write-Host "Sent: $i"
    Start-Sleep -Milliseconds 100  # 10 req/s
}
```

#### Kryteria sukcesu
- [ ] Wszystkie 100 wiadomości zostały opublikowane
- [ ] Wszystkie 100 wiadomości zostały odebrane
- [ ] Brak timeoutów lub błędów
- [ ] Średni czas dostarczenia < 200ms

---

### Test 13: Concurrent subscribers

#### Cel
Weryfikacja wydajności przy wielu równoczesnych subskrybentach.

#### Procedura

```powershell
# Uruchom 10 subskrybentów
for ($i = 1; $i -le 10; $i++) {
    Start-Process -NoNewWindow mosquitto_sub -ArgumentList "-h", "localhost", "-t", "scaleit/#", "-v"
}

# Wyślij wiadomość testową
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'

# Sprawdź czy wszystkie subskrybenty otrzymały wiadomość
```

#### Kryteria sukcesu
- [ ] Wszyscy subskrybenci otrzymują wiadomości
- [ ] Brak znaczącego opóźnienia przy wielu subskrybentach
- [ ] Broker pozostaje stabilny

---

## Testy integracyjne

### Test 14: Integracja z Home Assistant

#### Cel
Weryfikacja integracji z Home Assistant przez MQTT.

#### Setup Home Assistant

Dodaj do `configuration.yaml`:

```yaml
mqtt:
  sensor:
    - name: "Scale Weight Test"
      state_topic: "scaleit/weight/c320tcp"
      value_template: "{{ value_json.weight }}"
      unit_of_measurement: "kg"
      json_attributes_topic: "scaleit/weight/c320tcp"
      
    - name: "Scale Stable Test"
      state_topic: "scaleit/weight/c320tcp"
      value_template: "{{ value_json.is_stable }}"
```

#### Procedura

```powershell
# 1. Wyślij komendę przez MQTT
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'

# 2. Sprawdź w Home Assistant:
#    - Developer Tools → States
#    - Znajdź sensor.scale_weight_test
#    - Wartość powinna odpowiadać odczytowi masy
```

#### Kryteria sukcesu
- [ ] Home Assistant odbiera wiadomości MQTT
- [ ] Sensor pokazuje poprawną wartość masy
- [ ] Atrybuty JSON są dostępne
- [ ] Aktualizacje są w czasie rzeczywistym

---

### Test 15: Integracja z Node-RED

#### Cel
Weryfikacja integracji z Node-RED.

#### Setup Node-RED

1. Zainstaluj Node-RED: `npm install -g node-red`
2. Dodaj palety: `node-red-dashboard`
3. Utwórz flow:

```json
[
    {
        "id": "mqtt-in",
        "type": "mqtt in",
        "topic": "scaleit/weight/+",
        "broker": "localhost:1883"
    },
    {
        "id": "json-parse",
        "type": "json",
        "action": "obj"
    },
    {
        "id": "debug",
        "type": "debug",
        "active": true
    }
]
```

#### Procedura

```powershell
# 1. Uruchom Node-RED
node-red

# 2. Import flow i deploy

# 3. Wyślij komendę
mosquitto_pub -h localhost -t "scaleit/command/c320tcp" `
    -m '{"device_id":"c320tcp","command":"readGross"}'

# 4. Sprawdź debug panel w Node-RED
```

#### Kryteria sukcesu
- [ ] Node-RED odbiera wiadomości MQTT
- [ ] Payload JSON jest poprawnie parsowany
- [ ] Dane są dostępne w flow

---

## Testy bezpieczeństwa

### Test 16: Autentykacja MQTT

#### Cel
Weryfikacja autentykacji MQTT z username/password.

#### Setup

```powershell
# 1. Utwórz plik haseł Mosquitto
mosquitto_passwd -c C:\mosquitto\passwd scaleit_user

# 2. Zaktualizuj mosquitto.conf
# allow_anonymous false
# password_file C:\mosquitto\passwd

# 3. Restart Mosquitto
net restart mosquitto

# 4. Skonfiguruj Bridge
$env:MQTT_USERNAME="scaleit_user"
$env:MQTT_PASSWORD="your_password"
net restart ScaleCmdBridge
```

#### Procedura

```powershell
# Test bez credentials (powinno się nie udać)
mosquitto_sub -h localhost -t "scaleit/#" -v
# Oczekiwany błąd: Connection refused

# Test z credentials (powinno działać)
mosquitto_sub -h localhost -t "scaleit/#" -v -u scaleit_user -P your_password
```

#### Kryteria sukcesu
- [ ] Połączenie bez credentials jest odrzucane
- [ ] Połączenie z poprawnymi credentials działa
- [ ] Bridge łączy się z credentials

---

### Test 17: TLS/SSL

#### Cel
Weryfikacja szyfrowanego połączenia MQTT.

#### Setup

```powershell
# 1. Wygeneruj certyfikaty (lub użyj istniejących)
# 2. Skonfiguruj Mosquitto dla TLS
# 3. Skonfiguruj Bridge
$env:MQTT_BROKER_URL="mqtts://localhost:8883"
```

#### Procedura

```powershell
# Test połączenia SSL
mosquitto_sub -h localhost -p 8883 --cafile ca.crt -t "scaleit/#" -v
```

#### Kryteria sukcesu
- [ ] Połączenie SSL/TLS działa
- [ ] Certyfikaty są weryfikowane
- [ ] Bridge łączy się przez SSL

---

## Skrypty automatyzacji testów

### run-mqtt-tests.ps1

```powershell
# /scripts/run-mqtt-tests.ps1
# Automatyczne uruchomienie testów MQTT

param(
    [string]$BrokerHost = "localhost",
    [int]$BrokerPort = 1883,
    [string]$TopicPrefix = "scaleit"
)

Write-Host "===== MQTT Network Tests =====" -ForegroundColor Cyan

# Test 1: Broker connectivity
Write-Host "`n[Test 1] Broker Connectivity..." -ForegroundColor Yellow
$tcpTest = Test-NetConnection -ComputerName $BrokerHost -Port $BrokerPort
if ($tcpTest.TcpTestSucceeded) {
    Write-Host "  PASS: Broker is reachable at ${BrokerHost}:${BrokerPort}" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Cannot connect to ${BrokerHost}:${BrokerPort}" -ForegroundColor Red
    exit 1
}

# Test 2: Subscribe and publish
Write-Host "`n[Test 2] Pub/Sub Test..." -ForegroundColor Yellow
$testMessage = '{"test":"message","timestamp":' + [int](Get-Date -UFormat %s) + '}'
$testTopic = "$TopicPrefix/test/connectivity"

# Start subscriber in background
$subJob = Start-Job -ScriptBlock {
    param($host, $topic)
    mosquitto_sub -h $host -t $topic -C 1 -W 10
} -ArgumentList $BrokerHost, $testTopic

# Publish message
Start-Sleep -Seconds 1
mosquitto_pub -h $BrokerHost -t $testTopic -m $testMessage

# Wait for subscriber
$result = Receive-Job -Job $subJob -Wait -Timeout 15
Stop-Job -Job $subJob -ErrorAction SilentlyContinue
Remove-Job -Job $subJob -Force -ErrorAction SilentlyContinue

if ($result -like "*test*") {
    Write-Host "  PASS: Message published and received" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Message not received" -ForegroundColor Red
}

# Test 3: Weight topic format
Write-Host "`n[Test 3] Weight Topic Format..." -ForegroundColor Yellow
# ... additional tests

Write-Host "`n===== Tests Complete =====" -ForegroundColor Cyan
```

---

## Checklist testów

### Testy podstawowe
- [ ] **Test 1**: Weryfikacja połączenia z brokerem
- [ ] **Test 2**: Publikowanie odczytów masy
- [ ] **Test 3**: Wykonywanie komend przez MQTT
- [ ] **Test 4**: Status urządzenia
- [ ] **Test 5**: QoS (Quality of Service)
- [ ] **Test 6**: Retain flag

### Testy sieciowe (LAN)
- [ ] **Test 7**: Dostęp MQTT z innego komputera
- [ ] **Test 8**: Multi-client subscription

### Testy error handling
- [ ] **Test 9**: Reconnection po utracie połączenia
- [ ] **Test 10**: Broker niedostępny przy starcie
- [ ] **Test 11**: Invalid broker URL

### Testy wydajnościowe
- [ ] **Test 12**: High-frequency publishing
- [ ] **Test 13**: Concurrent subscribers

### Testy integracyjne
- [ ] **Test 14**: Integracja z Home Assistant
- [ ] **Test 15**: Integracja z Node-RED

### Testy bezpieczeństwa
- [ ] **Test 16**: Autentykacja MQTT
- [ ] **Test 17**: TLS/SSL

---

## Troubleshooting

### Problem: "Connection refused" do brokera

**Przyczyny:**
1. Mosquitto nie jest uruchomiony
2. Firewall blokuje port 1883
3. Broker nasłuchuje tylko na localhost

**Rozwiązania:**

```powershell
# Sprawdź status Mosquitto
sc query mosquitto

# Sprawdź na jakim adresie nasłuchuje
netstat -ano | findstr :1883

# Sprawdź firewall
netsh advfirewall firewall show rule name="MQTT Broker - Port 1883"

# Sprawdź konfigurację Mosquitto
Get-Content "C:\Program Files\mosquitto\mosquitto.conf" | Select-String "listener"
```

### Problem: Wiadomości nie są publikowane

**Przyczyny:**
1. MQTT_ENABLED nie jest ustawione na "true"
2. Błędny MQTT_BROKER_URL
3. Problem z autentykacją

**Rozwiązania:**

```powershell
# Sprawdź zmienne środowiskowe
Get-ChildItem Env:MQTT*

# Sprawdź logi Bridge
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 20

# Test bezpośredni
mosquitto_pub -h localhost -t "test" -m "test message" -d
```

### Problem: Komendy MQTT nie są wykonywane

**Przyczyny:**
1. Subscriber nie jest podłączony
2. Nieprawidłowy format JSON
3. Nieprawidłowy temat komendy

**Rozwiązania:**

```powershell
# Sprawdź czy subscriber jest aktywny
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" | Select-String "subscriber"

# Test z prostszą komendą
mosquitto_pub -h localhost -t "scaleit/command/test" -m '{"device_id":"test","command":"readGross"}'

# Sprawdź logi wykonania komend
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" | Select-String "MQTT command"
```

### Problem: Reconnection nie działa

**Przyczyny:**
1. Exponential backoff - może trzeba poczekać
2. Broker nadal niedostępny
3. Problem z credentials po restarcie brokera

**Rozwiązania:**

```powershell
# Sprawdź aktualny stan reconnection
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 30

# Oczekiwane logi:
# "MQTT publisher event loop error: Connection refused"
# Po kilku próbach z rosnącym opóźnieniem:
# "MQTT publisher connected successfully"

# Jeśli nie łączy się przez >60s, sprawdź broker
sc query mosquitto
```

---

## Dokumentacja powiązana

- [MQTT_INTEGRATION.md](./MQTT_INTEGRATION.md) - Ogólna dokumentacja MQTT
- [MQTT_QUICKSTART.md](./MQTT_QUICKSTART.md) - Szybki start z MQTT
- [TESTING_NETWORK_ACCESS.md](./TESTING_NETWORK_ACCESS.md) - Testy dostępu sieciowego HTTP
- [NETWORK_TROUBLESHOOTING.md](./NETWORK_TROUBLESHOOTING.md) - Rozwiązywanie problemów sieciowych

---

## Wersja i aktualizacje

| Wersja | Data | Zmiany |
|--------|------|--------|
| 1.0.0 | 2026-01-14 | Pierwsza wersja dokumentacji |

**Autor:** Testing Agent  
**Status:** Draft  
**Recenzja:** Wymagana
