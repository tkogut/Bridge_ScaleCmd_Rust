# Instrukcja testowania dostępu sieciowego do ScaleIT Bridge

Ten dokument zawiera krok po kroku instrukcje testowania dostępu do Bridge z innego komputera w sieci lokalnej.

## Prerekwizyty

- **Komputer Master**: Komputer z zainstalowanym i uruchomionym ScaleIT Bridge
- **Komputer Client**: Inny komputer w tej samej sieci lokalnej
- Oba komputery muszą być w tej samej sieci (np. 192.168.1.x)

## Krok 1: Przygotowanie komputera Master

### 1.1 Sprawdź czy Bridge jest uruchomiony

```powershell
# Na komputerze Master (zainstalowany Bridge)
sc query ScaleCmdBridge

# Powinieneś zobaczyć: STATE: 4 RUNNING
```

### 1.2 Sprawdź IP komputera Master

```powershell
# Na komputerze Master
ipconfig

# Szukaj sekcji "Ethernet adapter" lub "Wireless LAN adapter"
# Znajdź "IPv4 Address", np.: 192.168.1.100
# Zapisz ten adres IP - będziesz go potrzebował!
```

### 1.3 Sprawdź czy Bridge nasłuchuje na sieci

```powershell
# Na komputerze Master
netstat -ano | findstr :8080

# Powinieneś zobaczyć: TCP    0.0.0.0:8080    0.0.0.0:0    LISTENING
# Jeśli widzisz tylko 127.0.0.1:8080 - Bridge nie przyjmuje połączeń z sieci!
```

### 1.4 Sprawdź firewall

```powershell
# Na komputerze Master
netsh advfirewall firewall show rule name="ScaleIT Bridge - TCP Port 8080"

# Jeśli reguła nie istnieje, dodaj ją:
netsh advfirewall firewall add rule name="ScaleIT Bridge - TCP Port 8080" ^
    dir=in action=allow protocol=TCP localport=8080 profile=Private ^
    description="Allows access to ScaleIT Bridge service from local network"
```

### 1.5 Test lokalny (na Master)

```powershell
# Na komputerze Master - sprawdź czy Bridge odpowiada
Invoke-WebRequest http://localhost:8080/health

# Powinieneś otrzymać JSON:
# {
#   "status": "OK",
#   "service": "ScaleIT Bridge",
#   "version": "0.1.5"
# }
```

**Wynik:** Jeśli wszystko działa, przejdź do Kroku 2.

## Krok 2: Test z komputera Client (opcja 1 - bezpośredni dostęp)

### 2.1 Sprawdź czy komputery są w tej samej sieci

```powershell
# Na komputerze Client
ipconfig

# Sprawdź czy IP zaczyna się od tego samego prefiksu co Master
# Np. jeśli Master: 192.168.1.100, Client powinien mieć: 192.168.1.xxx
```

### 2.2 Test ping do Master

```powershell
# Na komputerze Client
ping <IP_MASTER>
# Przykład: ping 192.168.1.100

# Powinieneś zobaczyć odpowiedzi (Reply from 192.168.1.100)
# Jeśli nie ma odpowiedzi - sprawdź połączenie sieciowe!
```

### 2.3 Test połączenia do portu 8080

```powershell
# Na komputerze Client
Test-NetConnection -ComputerName <IP_MASTER> -Port 8080
# Przykład: Test-NetConnection -ComputerName 192.168.1.100 -Port 8080

# Powinieneś zobaczyć: TcpTestSucceeded : True
# Jeśli False - sprawdź firewall na Master!
```

### 2.4 Test API z przeglądarki

1. **Otwórz przeglądarkę** na komputerze Client
2. **Wpisz w pasku adresu:**
   ```
   http://<IP_MASTER>:8080/health
   ```
   Przykład: `http://192.168.1.100:8080/health`

3. **Powinieneś zobaczyć JSON:**
   ```json
   {
     "status": "OK",
     "service": "ScaleIT Bridge",
     "version": "0.1.5"
   }
   ```

4. **Sprawdź informacje o serwerze:**
   ```
   http://<IP_MASTER>:8080/api/server/info
   ```
   Przykład: `http://192.168.1.100:8080/api/server/info`

   Powinieneś zobaczyć:
   ```json
   {
     "hostname": "COMPUTER-NAME",
     "ip_addresses": ["192.168.1.100", "127.0.0.1"],
     "port": 8080,
     "network_mode": "lan",
     "version": "0.1.5"
   }
   ```

### 2.5 Test pełnego UI

1. **Otwórz przeglądarkę** na komputerze Client
2. **Wpisz w pasku adresu:**
   ```
   http://<IP_MASTER>:8080
   ```
   Przykład: `http://192.168.1.100:8080`

3. **Powinieneś zobaczyć:**
   - Interfejs Bridge UI
   - Listę urządzeń (jeśli skonfigurowane)
   - Możliwość wykonania komend na wadze

**Wynik:** Jeśli widzisz UI, przejdź do Kroku 3 aby przetestować odczyt masy.

## Krok 3: Test z komputera Client (opcja 2 - Auto-detection)

### 3.1 Uruchom lokalny frontend (opcjonalnie)

Jeśli chcesz przetestować z lokalnym frontendem na komputerze Client:

```powershell
# Na komputerze Client (jeśli masz zainstalowany Node.js)
cd <sciezka_do_projektu>
npm install  # tylko pierwszy raz
npm run dev
```

Frontend uruchomi się na `http://localhost:5173`

### 3.2 Skonfiguruj Master Server przez UI

1. **Otwórz Bridge UI** na komputerze Client
   - Jeśli używasz lokalnego frontendu: `http://localhost:5173`
   - Jeśli używasz frontendu z Master: `http://<IP_MASTER>:8080`

2. **Przejdź do Configuration**
   - Kliknij "Configuration" w menu bocznym

3. **Znajdź sekcję "Master Server Configuration"**

4. **Auto-Detection:**
   - Kliknij przycisk **"Auto-Detect Master Server"**
   - Poczekaj na zakończenie skanowania (może zająć kilka minut)
   - Postęp będzie widoczny na pasku postępu
   - Jeśli master zostanie znaleziony, IP zostanie automatycznie skonfigurowany

5. **Lub Manual Configuration:**
   - Wprowadź IP Master serwera (np. `192.168.1.100`)
   - Wprowadź port (domyślnie `8080`)
   - Kliknij **"Save Configuration"**

6. **Test Connection:**
   - Kliknij **"Test Connection"**
   - Powinieneś zobaczyć:
     - Status: **Connected** (zielony badge)
     - Hostname: Nazwa komputera Master
     - Version: Wersja Bridge
     - Network Mode: "lan"
     - Available IPs: Lista dostępnych IP Master serwera

**Wynik:** Jeśli test połączenia zakończył się sukcesem, przejdź do Kroku 4.

## Krok 4: Test odczytu masy z wagi

### 4.1 Sprawdź czy waga jest skonfigurowana

1. **Na komputerze Master**, sprawdź czy waga jest skonfigurowana:
   ```powershell
   # Otwórz plik konfiguracji
   notepad "C:\ProgramData\ScaleCmdBridge\config\devices.json"
   ```

2. **Lub przez UI:**
   - Otwórz `http://<IP_MASTER>:8080` (z Master lub Client)
   - Przejdź do Configuration
   - Sprawdź czy są skonfigurowane urządzenia

### 4.2 Test odczytu z komputera Client

**Metoda 1: Przez UI na komputerze Client**

1. Otwórz Bridge UI na komputerze Client: `http://<IP_MASTER>:8080`
   - Lub lokalny frontend z skonfigurowanym Master IP: `http://localhost:5173`

2. Przejdź do głównej strony (Index)

3. Wybierz urządzenie z listy (jeśli masz skonfigurowane)

4. Kliknij przycisk **"Read Gross"** lub **"Read Net"**

5. **Powinieneś zobaczyć:**
   - Masę z wagi
   - Status połączenia
   - Informacje o jednostce

**Metoda 2: Przez API z komputera Client**

```powershell
# Na komputerze Client (PowerShell)
$masterIp = "192.168.1.100"  # Zmień na IP swojego Master

# Sprawdź listę urządzeń
Invoke-WebRequest -Uri "http://$masterIp:8080/devices" | Select-Object -ExpandProperty Content

# Wykonaj komendę odczytu masy (zamień device_id na prawdziwy)
$body = @{
    device_id = "twoj_device_id"
    command = "readGross"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://$masterIp:8080/scalecmd" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | Select-Object -ExpandProperty Content
```

**Metoda 3: Z przeglądarki (curl w DevTools)**

1. Otwórz przeglądarkę na komputerze Client
2. Otwórz DevTools (F12)
3. Przejdź do zakładki "Console"
4. Wykonaj:

```javascript
// Sprawdź health
fetch('http://192.168.1.100:8080/health')
  .then(r => r.json())
  .then(console.log);

// Sprawdź listę urządzeń
fetch('http://192.168.1.100:8080/devices')
  .then(r => r.json())
  .then(console.log);

// Wykonaj komendę (zamień device_id!)
fetch('http://192.168.1.100:8080/scalecmd', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_id: 'twoj_device_id',
    command: 'readGross'
  })
})
  .then(r => r.json())
  .then(console.log);
```

## Krok 5: Weryfikacja - Checklist

### Na Master:
- [ ] Bridge service działa (`sc query ScaleCmdBridge` → RUNNING)
- [ ] Bridge nasłuchuje na `0.0.0.0:8080` (nie tylko `127.0.0.1`)
- [ ] Firewall pozwala na połączenia z sieci (reguła dla profilu Private)
- [ ] Test lokalny działa (`http://localhost:8080/health` → OK)

### Na Client:
- [ ] Ping do Master działa (`ping <IP_MASTER>` → Reply)
- [ ] Test portu 8080 działa (`Test-NetConnection` → TcpTestSucceeded: True)
- [ ] Health check działa (`http://<IP_MASTER>:8080/health` → JSON response)
- [ ] Server info działa (`http://<IP_MASTER>:8080/api/server/info` → JSON response)
- [ ] UI jest dostępne (`http://<IP_MASTER>:8080` → Bridge UI)
- [ ] Auto-detection lub manual config działa
- [ ] Test connection w UI pokazuje "Connected"
- [ ] Odczyt masy z wagi działa (przez UI lub API)

## Typowe problemy i rozwiązania

### Problem: "Connection timeout" z Client

**Przyczyna:** Firewall blokuje połączenia

**Rozwiązanie:**
```powershell
# Na Master
netsh advfirewall firewall show rule name="ScaleIT Bridge - TCP Port 8080"
# Jeśli nie istnieje, dodaj regułę (patrz Krok 1.4)
```

### Problem: "CORS error" w przeglądarce

**Przyczyna:** Network Mode nie pozwala na origins z sieci

**Rozwiązanie:**
```powershell
# Na Master
cd "C:\Program Files\ScaleCmdBridge"
.\nssm.exe get ScaleCmdBridge AppEnvironmentExtra | Select-String "NETWORK_MODE"

# Jeśli NETWORK_MODE nie jest ustawiony lub jest "local", ustaw "lan":
.\nssm.exe set ScaleCmdBridge AppEnvironmentExtra "NETWORK_MODE=lan"
net restart ScaleCmdBridge
```

### Problem: Auto-detection nie znajduje Master

**Przyczyna:** Master IP jest w innym zakresie niż skanowany (np. 192.168.2.x)

**Rozwiązanie:**
- Użyj **manual configuration** zamiast auto-detection
- Wprowadź IP Master ręcznie w UI

### Problem: UI się ładuje, ale API nie działa

**Przyczyna:** Problem z konfiguracją Master IP w localStorage

**Rozwiązanie:**
1. Otwórz DevTools (F12)
2. Przejdź do Application → Local Storage
3. Usuń klucze: `MASTER_IP`, `MASTER_IP_AUTO`, `MASTER_PORT`
4. Odśwież stronę
5. Skonfiguruj Master IP ponownie

### Problem: "ERR_BLOCKED_BY_CLIENT" w przeglądarce

**Przyczyna:** AdBlocker lub rozszerzenia przeglądarki blokują połączenia

**Rozwiązanie:**
- Wyłącz AdBlocker dla `<IP_MASTER>:8080`
- Sprawdź inne rozszerzenia przeglądarki
- Spróbuj w trybie incognito/privately

## Przykładowy scenariusz testowy

### Setup:
- **Master:** Komputer z Windows, IP: `192.168.1.100`, Bridge zainstalowany jako service
- **Client:** Laptop z Windows, IP: `192.168.1.75`

### Test 1: Basic Connectivity
```powershell
# Na Client
ping 192.168.1.100
Test-NetConnection -ComputerName 192.168.1.100 -Port 8080
Invoke-WebRequest http://192.168.1.100:8080/health
```
**Oczekiwany rezultat:** Wszystkie komendy działają bez błędów

### Test 2: UI Access
1. Otwórz przeglądarkę na Client
2. Wpisz: `http://192.168.1.100:8080`
3. **Oczekiwany rezultat:** Bridge UI się ładuje, widać interfejs

### Test 3: Master Server Configuration
1. Przejdź do Configuration → Master Server Configuration
2. Kliknij "Test Connection"
3. **Oczekiwany rezultat:** Status "Connected", widoczne informacje o serwerze

### Test 4: Weight Reading
1. Przejdź do głównej strony
2. Wybierz urządzenie (jeśli skonfigurowane)
3. Kliknij "Read Gross"
4. **Oczekiwany rezultat:** Odczytana masa z wagi wyświetlona w UI

### Test 5: Auto-Detection (opcjonalnie)
1. Jeśli używasz lokalnego frontendu (`npm run dev` na Client)
2. Configuration → Master Server Configuration
3. Kliknij "Auto-Detect Master Server"
4. **Oczekiwany rezultat:** IP 192.168.1.100 zostaje wykryty po skanowaniu

## Weryfikacja logów

### Na Master - sprawdź logi Bridge:

```powershell
# Sprawdź logi stdout
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" -Tail 50

# Sprawdź logi stderr (błędy)
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stderr.log" -Tail 50

# Sprawdź czy są logi o połączeniach z sieci:
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\service-stdout.log" | Select-String "192.168.1.75"
# (zamień na IP swojego Client)
```

**Oczekiwane logi:**
```
Server running on http://0.0.0.0:8080
Server accessible at:
  - http://localhost:8080
  - http://192.168.1.100:8080
Network mode: Lan
Received health check request
Received scalecmd request for device: ...
```

## Dokumentacja dodatkowa

- Szczegółowa konfiguracja: [LOCAL_NETWORK_ACCESS.md](./LOCAL_NETWORK_ACCESS.md)
- Rozwiązywanie problemów: [NETWORK_TROUBLESHOOTING.md](./NETWORK_TROUBLESHOOTING.md)
- API Documentation: [SWAGGER_API_DOCUMENTATION.md](./SWAGGER_API_DOCUMENTATION.md)

## Kontakt i wsparcie

Jeśli napotkasz problemy:
1. Sprawdź logi na Master (patrz sekcja "Weryfikacja logów")
2. Sprawdź sekcję "Typowe problemy" powyżej
3. Sprawdź dokumentację troubleshootingu
