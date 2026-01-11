# Dostęp z sieci lokalnej do ScaleIT Bridge

Ten dokument opisuje jak skonfigurować dostęp do ScaleIT Bridge z innych komputerów w sieci lokalnej.

## Przegląd

Od wersji 0.1.5, ScaleIT Bridge domyślnie nasłuchuje na `0.0.0.0:8080`, co umożliwia dostęp z sieci lokalnej. Wcześniejsze wersje nasłuchiwały tylko na localhost (`127.0.0.1:8080`).

## Architektura

```
Komputer Master (z Bridge)          Inny komputer w sieci
┌─────────────────────────┐        ┌──────────────────────┐
│ ScaleIT Bridge          │        │ Frontend (Browser)   │
│ http://192.168.1.100:   │ ◄──────│ http://192.168.1.50  │
│           8080          │        │                      │
└─────────────────────────┘        └──────────────────────┘
           │
           ▼
    ┌─────────────┐
    │ Waga (TCP)  │
    └─────────────┘
```

## Konfiguracja Master Servera

### 1. Sprawdź adres IP komputera Master

```powershell
# Windows PowerShell
ipconfig

# Szukaj "IPv4 Address" dla aktywnego interfejsu sieciowego
# Przykład: 192.168.1.100
```

### 2. Sprawdź konfigurację Bridge

Upewnij się, że Bridge nasłuchuje na wszystkich interfejsach (`0.0.0.0`):

```powershell
# Sprawdź logi
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" -Tail 50 | Select-String "Server running"

# Powinieneś zobaczyć:
# Server running on http://0.0.0.0:8080
# Server accessible at:
#   - http://localhost:8080
#   - http://192.168.1.100:8080
```

### 3. Sprawdź Network Mode

```powershell
# Sprawdź czy NETWORK_MODE jest ustawiony na 'lan' (domyślny)
cd "C:\Program Files\ScaleCmdBridge"
.\nssm.exe get ScaleCmdBridge AppEnvironmentExtra

# Powinno być:
# NETWORK_MODE=lan
# (lub brak zmiennej - wtedy domyślnie 'lan')
```

### 4. Sprawdź Firewall

```powershell
# Sprawdź czy reguła firewall istnieje
netsh advfirewall firewall show rule name="ScaleIT Bridge - TCP Port 8080"

# Jeśli nie istnieje, dodaj ją:
netsh advfirewall firewall add rule name="ScaleIT Bridge - TCP Port 8080" ^
    dir=in action=allow protocol=TCP localport=8080 profile=Private ^
    description="Allows access to ScaleIT Bridge service from local network"
```

## Konfiguracja Client (inny komputer w sieci)

### Opcja 1: Bezpośredni dostęp przez IP

Najprostszy sposób - otwórz przeglądarkę na komputerze klienckim i wejdź na:

```
http://<IP_MASTER>:8080
```

Przykład:
```
http://192.168.1.100:8080
```

### Opcja 2: Auto-detection IP Master Servera

Frontend wspiera automatyczne wykrywanie IP master serwera:

1. Otwórz Bridge UI na komputerze klienckim (może być lokalny frontend lub http://IP_MASTER:8080)
2. Przejdź do **Configuration** → **Master Server Configuration**
3. Kliknij **"Auto-Detect Master Server"**
4. Poczekaj na zakończenie skanowania (może zająć kilka minut)
5. Jeśli master serwer zostanie wykryty, będzie automatycznie skonfigurowany

### Opcja 3: Ręczna konfiguracja IP

1. Otwórz Bridge UI na komputerze klienckim
2. Przejdź do **Configuration** → **Master Server Configuration**
3. W sekcji **"Manual Configuration"** wprowadź:
   - **IP Address**: IP komputera master (np. `192.168.1.100`)
   - **Port**: Port Bridge (domyślnie `8080`)
4. Kliknij **"Save Configuration"**
5. Kliknij **"Test Connection"** aby sprawdzić połączenie

### Opcja 4: Konfiguracja przez zmienną środowiskową (Development)

Jeśli uruchamiasz frontend lokalnie (np. `npm run dev`), możesz ustawić zmienną środowiskową:

```powershell
# PowerShell
$env:VITE_BRIDGE_URL="http://192.168.1.100:8080"
npm run dev

# Lub w .env file:
VITE_BRIDGE_URL=http://192.168.1.100:8080
```

## Priorytet konfiguracji Master Server IP

Frontend używa następującego priorytetu przy określaniu adresu IP master serwera:

1. **Manual Configuration** - ręcznie ustawiony IP w localStorage (`MASTER_IP`)
2. **Auto-detected IP** - automatycznie wykryty IP (cache w localStorage `MASTER_IP_AUTO`)
3. **Current window hostname** - IP z aktualnego URL (jeśli nie jest localhost)
4. **Fallback** - localhost (`127.0.0.1:8080`)

## Testowanie połączenia

### Z poziomu UI

1. Przejdź do **Configuration** → **Master Server Configuration**
2. Kliknij **"Test Connection"**
3. Jeśli połączenie jest udane, zobaczysz:
   - Status: **Connected** (zielony badge)
   - Informacje o serwerze: hostname, version, network mode, dostępne IPs

### Z poziomu API

```powershell
# Z komputera klienckiego
$masterIp = "192.168.1.100"
Invoke-WebRequest -Uri "http://$masterIp:8080/health"
Invoke-WebRequest -Uri "http://$masterIp:8080/api/server/info"

# Lub curl (jeśli dostępny)
curl http://192.168.1.100:8080/health
curl http://192.168.1.100:8080/api/server/info
```

### Z poziomu przeglądarki

Otwórz w przeglądarce na komputerze klienckim:
```
http://<IP_MASTER>:8080/health
```

Powinieneś zobaczyć JSON response:
```json
{
  "status": "OK",
  "service": "ScaleIT Bridge",
  "version": "0.1.5"
}
```

## Network Mode Configuration

Bridge wspiera trzy tryby dostępu sieciowego:

### Local Mode (`NETWORK_MODE=local`)

- Tylko localhost (`127.0.0.1`, `localhost`)
- CORS: tylko localhost origins
- Użycie: Development, testowanie lokalne

### LAN Mode (`NETWORK_MODE=lan`) - Domyślny

- Sieć lokalna (prywatne zakresy IP)
- CORS: wszystkie origins z prywatnych IP ranges
- Użycie: Produkcja w sieci lokalnej

Zakresy IP:
- `192.168.0.0/16` (192.168.0.0 - 192.168.255.255)
- `10.0.0.0/8` (10.0.0.0 - 10.255.255.255)
- `172.16.0.0/12` (172.16.0.0 - 172.31.255.255)
- `127.0.0.0/8` (localhost)

### Restricted Mode (`NETWORK_MODE=restricted`)

- Lista dozwolonych origins zdefiniowana w `ALLOWED_ORIGINS`
- CORS: tylko origins z listy
- Użycie: Produkcja z kontrolą dostępu

Przykład konfiguracji:
```powershell
.\nssm.exe set ScaleCmdBridge AppEnvironmentExtra "NETWORK_MODE=restricted"
.\nssm.exe set ScaleCmdBridge AppEnvironmentExtra "ALLOWED_ORIGINS=http://192.168.1.50:5173,http://192.168.1.100:8080"
net restart ScaleCmdBridge
```

## Rozwiązywanie problemów

### Problem: Nie mogę połączyć się z master serwerem

1. **Sprawdź firewall na master:**
   ```powershell
   netsh advfirewall firewall show rule name="ScaleIT Bridge - TCP Port 8080"
   ```

2. **Sprawdź czy Bridge działa:**
   ```powershell
   # Na master
   sc query ScaleCmdBridge
   Invoke-WebRequest http://localhost:8080/health
   ```

3. **Sprawdź Network Mode:**
   ```powershell
   .\nssm.exe get ScaleCmdBridge AppEnvironmentExtra | Select-String "NETWORK_MODE"
   ```

4. **Sprawdź logi:**
   ```powershell
   Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" -Tail 50
   ```

### Problem: CORS errors w przeglądarce

Upewnij się, że `NETWORK_MODE=lan` (domyślny) lub `ALLOWED_ORIGINS` zawiera origin klienta.

```powershell
# Sprawdź Network Mode
.\nssm.exe get ScaleCmdBridge AppEnvironmentExtra

# Jeśli restricted, dodaj origin klienta do ALLOWED_ORIGINS
.\nssm.exe set ScaleCmdBridge AppEnvironmentExtra "ALLOWED_ORIGINS=http://192.168.1.50:5173,http://192.168.1.100:8080"
net restart ScaleCmdBridge
```

### Problem: Auto-detection nie znajduje master serwera

Auto-detection skanuje tylko najpopularniejsze zakresy IP:
- `192.168.0.1-254`
- `192.168.1.1-254`
- `10.0.0.1-254`

Jeśli master serwer jest w innym zakresie (np. `192.168.2.100`), użyj ręcznej konfiguracji IP.

### Problem: Connection timeout

1. Sprawdź czy master serwer jest dostępny z klienta:
   ```powershell
   # Z komputera klienckiego
   Test-NetConnection -ComputerName 192.168.1.100 -Port 8080
   ```

2. Sprawdź firewall na master:
   ```powershell
   # Na master
   netsh advfirewall firewall show rule name="ScaleIT Bridge - TCP Port 8080"
   ```

3. Sprawdź czy Bridge nasłuchuje na `0.0.0.0:8080`:
   ```powershell
   netstat -ano | findstr :8080
   # Powinieneś zobaczyć: 0.0.0.0:8080
   ```

## Bezpieczeństwo

### Dla sieci lokalnej (LAN Mode)

- **Firewall**: Tylko profil "Private" (sieć lokalna), nie "Public" ani "Domain"
- **CORS**: Automatycznie dozwolone origins z prywatnych IP ranges
- **Brak autoryzacji**: Dostęp otwarty w sieci lokalnej (można dodać w przyszłości)

### Dla dostępu zewnętrznego (przyszłość)

- **SSL/TLS**: Struktura przygotowana (`config/ssl.rs`)
- **Authentication**: Struktura przygotowana (`auth/mod.rs`)
- **MQTT**: Struktura przygotowana (`mqtt/mod.rs`)

**Uwaga:** Obecna implementacja nie wspiera jeszcze dostępu zewnętrznego (spoza sieci lokalnej). To będzie dostępne w przyszłych wersjach.

## Przykłady użycia

### Scenariusz 1: Tablet w sieci lokalnej odczytuje masę z wagi

1. Master: Komputer z Bridge (192.168.1.100:8080)
2. Client: Tablet (192.168.1.50)
3. Konfiguracja na tablecie:
   - Otwórz Bridge UI: `http://192.168.1.100:8080`
   - Albo skonfiguruj ręcznie w **Configuration** → **Master Server Configuration**

### Scenariusz 2: Laptop deweloperski testuje Bridge

1. Master: Komputer produkcyjny z Bridge (192.168.1.100:8080)
2. Client: Laptop deweloperski (192.168.1.75) uruchamiający `npm run dev`
3. Konfiguracja:
   ```powershell
   # Na laptopie
   $env:VITE_BRIDGE_URL="http://192.168.1.100:8080"
   npm run dev
   ```
   Albo ręcznie w UI: `http://localhost:5173` → Configuration → Master Server Configuration

### Scenariusz 3: Wiele komputerów w sieci

1. Master: Jeden komputer z Bridge (192.168.1.100:8080)
2. Clients: Wiele komputerów w sieci lokalnej
3. Każdy client może:
   - Otworzyć bezpośrednio: `http://192.168.1.100:8080`
   - Lub skonfigurować lokalny frontend do łączenia się z master

## API Endpoint: Server Info

Nowy endpoint `/api/server/info` zwraca informacje o master serwerze:

```bash
curl http://192.168.1.100:8080/api/server/info
```

Response:
```json
{
  "hostname": "COMPUTER-NAME",
  "ip_addresses": ["192.168.1.100", "10.0.0.5", "127.0.0.1"],
  "port": 8080,
  "network_mode": "lan",
  "version": "0.1.5"
}
```

Ten endpoint jest używany przez frontend do auto-detection master serwera.

## Przyszłe funkcje

- **Dostęp zewnętrzny** (IP+port spoza sieci lokalnej) - w przygotowaniu
- **MQTT integration** - struktura przygotowana (`mqtt/mod.rs`)
- **SSL/TLS support** - struktura przygotowana (`config/ssl.rs`)
- **Authentication/Authorization** - struktura przygotowana (`auth/mod.rs`)
