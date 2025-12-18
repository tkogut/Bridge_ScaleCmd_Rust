# Troubleshooting Guide

## Problem 1: Frontend nie działa na localhost:5173

**Symptom:** Po uruchomieniu Bridge na `localhost:8080`, frontend nie jest dostępny na `localhost:5173`.

**Przyczyna:** Frontend dev server (`npm run dev`) nie jest uruchomiony. W trybie produkcyjnym, frontend jest serwowany przez Bridge na `localhost:8080`.

**Rozwiązanie:**

### Opcja A: Użyj Bridge jako serwera frontendu (zalecane dla produkcji)
1. Zainstaluj Bridge używając instalatora Windows
2. Frontend jest automatycznie budowany i kopiowany do `C:\Program Files\ScaleCmdBridge\web`
3. Otwórz przeglądarkę: `http://localhost:8080`
4. Frontend będzie dostępny automatycznie

### Opcja B: Uruchom frontend dev server (tylko dla developmentu)
```powershell
npm install
npm run dev
# Frontend dostępny na: http://localhost:5173
```

**Uwaga:** W trybie developmentu, frontend na `localhost:5173` próbuje połączyć się z Bridge na `localhost:8080`. Upewnij się, że Bridge jest uruchomiony.

---

## Problem 2: Błąd 500 przy wykonywaniu komend (readgross, readnet, etc.)

**Symptom:** API zwraca błąd 500 (Internal Server Error) przy próbie wykonania komendy na wadze.

**Możliwe przyczyny:**

1. **Device ID jest pusty lub nieprawidłowy**
   - Sprawdź w logach Bridge: `C:\ProgramData\ScaleCmdBridge\logs\scaleit-bridge.log`
   - Upewnij się, że device_id w requestcie nie jest pusty

2. **Urządzenie nie istnieje lub jest wyłączone**
   - Sprawdź listę urządzeń: `GET http://localhost:8080/devices`
   - Upewnij się, że urządzenie jest włączone (`enabled: true`)

3. **Problem z połączeniem do urządzenia**
   - Sprawdź konfigurację urządzenia w `C:\ProgramData\ScaleCmdBridge\config\devices.json`
   - Upewnij się, że urządzenie jest dostępne (TCP/IP lub Serial)

4. **CORS problem (tylko dla zewnętrznych aplikacji)**
   - Bridge automatycznie obsługuje CORS dla wszystkich origins
   - Jeśli używasz zewnętrznej aplikacji (np. Vercel), upewnij się, że Bridge jest dostępny z internetu

**Rozwiązanie:**

1. Sprawdź logi Bridge:
   ```powershell
   Get-Content "C:\ProgramData\ScaleCmdBridge\logs\scaleit-bridge.log" -Tail 50
   ```

2. Sprawdź status Bridge:
   ```powershell
   curl http://localhost:8080/health
   ```

3. Sprawdź listę urządzeń:
   ```powershell
   curl http://localhost:8080/devices
   ```

4. Sprawdź konfigurację urządzenia:
   ```powershell
   Get-Content "C:\ProgramData\ScaleCmdBridge\config\devices.json" | ConvertFrom-Json
   ```

---

## Problem 3: Vercel/Caffeine nie może połączyć się z Bridge

**Symptom:** Aplikacja na Vercel pokazuje status "Running", ale API zwraca błąd 500.

**Przyczyna:** Bridge działa na `localhost:8080`, który jest dostępny tylko lokalnie. Vercel działa w chmurze i nie ma dostępu do lokalnego Bridge.

**Rozwiązanie:**

### Opcja A: Użyj IP komputera zamiast localhost
1. Znajdź IP komputera z Bridge:
   ```powershell
   ipconfig
   # Szukaj IPv4 Address (np. 192.168.1.100)
   ```

2. Skonfiguruj Vercel Environment Variable:
   - Vercel Dashboard → Project → Settings → Environment Variables
   - Dodaj: `VITE_BRIDGE_URL=http://192.168.1.100:8080`
   - Redeploy aplikacji

**Uwaga:** To działa tylko jeśli Vercel i Bridge są w tej samej sieci lokalnej.

### Opcja B: Użyj tunelu (ngrok, Cloudflare Tunnel)
```powershell
# Przykład z ngrok
ngrok http 8080
# Użyj otrzymanego URL: https://xxxx.ngrok.io
```

### Opcja C: Uruchom frontend lokalnie
Jeśli Bridge jest lokalny, uruchom też frontend lokalnie:
```powershell
npm run dev
```

---

## Problem 4: Frontend nie jest dostępny po instalacji

**Symptom:** Po instalacji Bridge, frontend nie jest dostępny na `http://localhost:8080`.

**Przyczyna:** Frontend nie został zbudowany lub nie został skopiowany do folderu `web`.

**Rozwiązanie:**

1. Sprawdź czy folder `web` istnieje:
   ```powershell
   Test-Path "C:\Program Files\ScaleCmdBridge\web\index.html"
   ```

2. Jeśli folder nie istnieje, przebuduj instalator:
   ```powershell
   .\scripts\Build-WindowsInstaller.ps1
   ```

3. Sprawdź logi Bridge podczas uruchamiania:
   ```powershell
   # W logach powinno być:
   # "Serving static files from: C:\Program Files\ScaleCmdBridge\web"
   ```

4. Jeśli folder istnieje, ale Bridge go nie znajduje, sprawdź uprawnienia:
   ```powershell
   icacls "C:\Program Files\ScaleCmdBridge\web"
   ```

---

## Problem 5: CORS error w przeglądarce

**Symptom:** Przeglądarka blokuje requesty z powodu CORS.

**Przyczyna:** Bridge powinien automatycznie obsługiwać CORS, ale może być problem z konfiguracją.

**Rozwiązanie:**

1. Sprawdź nagłówki CORS w odpowiedzi:
   ```powershell
   curl -H "Origin: http://localhost:5173" -v http://localhost:8080/health
   ```

2. Powinieneś zobaczyć:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: *
   Access-Control-Allow-Headers: *
   ```

3. Jeśli nagłówki nie są obecne, przebuduj Bridge:
   ```powershell
   cd src-rust
   cargo build --release
   ```

---

## Sprawdzanie logów

### Windows Event Viewer
1. Otwórz Event Viewer
2. Przejdź do: Windows Logs → Application
3. Szukaj źródła: "ScaleCmdBridge"

### Plik logów
```powershell
Get-Content "C:\ProgramData\ScaleCmdBridge\logs\scaleit-bridge.log" -Tail 50 -Wait
```

---

## Kontakt i wsparcie

Jeśli problem nadal występuje:
1. Sprawdź logi Bridge
2. Sprawdź konfigurację urządzeń
3. Sprawdź status Bridge: `http://localhost:8080/health`
4. Sprawdź listę urządzeń: `http://localhost:8080/devices`

