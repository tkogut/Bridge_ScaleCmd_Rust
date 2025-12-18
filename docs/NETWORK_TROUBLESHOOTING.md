# Rozwiązywanie problemów z siecią

## Problem: Connection timeout do urządzenia

Jeśli Bridge nie może połączyć się z urządzeniem (`Connection timeout to 192.168.1.254:4001`), może to oznaczać problem z siecią.

## Diagnostyka

### 1. Sprawdź czy komputer jest w tej samej sieci co urządzenie

```powershell
# Sprawdź adres IP komputera
ipconfig

# Szukaj IPv4 Address (np. 192.168.1.100)
# Jeśli komputer ma IP np. 192.168.0.x, a urządzenie 192.168.1.254 - są w różnych sieciach!
```

**Przykład:**
- Komputer: `192.168.1.100` ✅ (ta sama sieć)
- Urządzenie: `192.168.1.254` ✅ (ta sama sieć)

**Problem:**
- Komputer: `192.168.0.100` ❌ (inna sieć)
- Urządzenie: `192.168.1.254` ❌ (inna sieć)

### 2. Sprawdź czy urządzenie jest dostępne

```powershell
# Test połączenia TCP
Test-NetConnection -ComputerName 192.168.1.254 -Port 4001

# Lub ping
ping 192.168.1.254

# Lub telnet (jeśli zainstalowany)
telnet 192.168.1.254 4001
```

### 3. Sprawdź routing

```powershell
# Sprawdź czy można dotrzeć do urządzenia
tracert 192.168.1.254

# Jeśli tracert pokazuje timeout lub "Destination host unreachable" - problem z siecią
```

## Rozwiązania

### Opcja 1: Przenieś komputer do tej samej sieci co urządzenie

1. Sprawdź adres IP urządzenia (z dokumentacji lub panelu konfiguracyjnego)
2. Upewnij się, że komputer jest w tej samej sieci:
   - Jeśli urządzenie: `192.168.1.254`
   - Komputer powinien mieć IP: `192.168.1.x` (gdzie x to 1-253)
3. Połącz komputer do tej samej sieci (WiFi lub kabel)

### Opcja 2: Zmień konfigurację Bridge na właściwy adres IP

Jeśli urządzenie jest w innej sieci, ale masz do niego dostęp przez router:

1. Sprawdź właściwy adres IP urządzenia
2. Zaktualizuj konfigurację Bridge:
   ```
   C:\ProgramData\ScaleCmdBridge\config\devices.json
   ```
3. Zmień `host` na właściwy adres IP
4. Zrestartuj usługę Bridge

### Opcja 3: Skonfiguruj routing/port forwarding

Jeśli urządzenie jest w innej sieci i nie możesz przenieść komputera:

1. Skonfiguruj port forwarding na routerze
2. Użyj adresu IP routera jako `host` w konfiguracji Bridge
3. Skonfiguruj port forwarding: zewnętrzny port → 192.168.1.254:4001

**Uwaga:** To rozwiązanie jest bardziej skomplikowane i wymaga konfiguracji routera.

### Opcja 4: Użyj VPN lub tunelu

Jeśli urządzenie jest w zdalnej sieci:

1. Skonfiguruj VPN między sieciami
2. Lub użyj tunelu (np. WireGuard, OpenVPN)
3. Po połączeniu VPN, Bridge powinien móc połączyć się z urządzeniem

## Sprawdzenie firewall

Windows Firewall może blokować połączenia wychodzące:

```powershell
# Sprawdź reguły firewall
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*ScaleCmdBridge*"}

# Jeśli brak reguł, dodaj wyjątek dla Bridge
New-NetFirewallRule -DisplayName "ScaleCmdBridge" -Direction Outbound -Program "C:\Program Files\ScaleCmdBridge\scaleit-bridge.exe" -Action Allow
```

## Najczęstsze przyczyny

1. **Komputer w innej sieci** - najczęstsza przyczyna
2. **Urządzenie wyłączone** - sprawdź czy urządzenie jest włączone
3. **Nieprawidłowy adres IP** - sprawdź dokumentację urządzenia
4. **Firewall blokuje** - sprawdź Windows Firewall i firewall routera
5. **Router nie routuje** - niektóre routery nie routują między podsieciami

## Przykładowa konfiguracja

### Scenariusz 1: Komputer i urządzenie w tej samej sieci

```
Komputer: 192.168.1.100
Urządzenie: 192.168.1.254
Port: 4001

Konfiguracja Bridge:
{
  "host": "192.168.1.254",
  "port": 4001
}
```

### Scenariusz 2: Komputer w innej sieci (wymaga routera)

```
Komputer: 192.168.0.100 (sieć A)
Router: 192.168.0.1 (sieć A) ↔ 192.168.1.1 (sieć B)
Urządzenie: 192.168.1.254 (sieć B)
Port: 4001

Konfiguracja Bridge:
{
  "host": "192.168.1.254",  // Jeśli router routuje między sieciami
  "port": 4001
}

LUB przez port forwarding:
{
  "host": "192.168.0.1",  // Adres routera w sieci komputera
  "port": 4001  // Port zewnętrzny na routerze
}
```

## Sprawdzenie po naprawie

Po naprawie problemu z siecią:

1. Zrestartuj usługę Bridge:
   ```powershell
   .\STOP-SERVICE.bat
   .\START-SERVICE.bat
   ```

2. Sprawdź logi:
   ```powershell
   Get-Content "C:\ProgramData\ScaleCmdBridge\logs\scaleit-bridge.log" -Tail 20
   ```

3. Powinieneś zobaczyć:
   ```
   Successfully connected to Rinstrum C320 at 192.168.1.254:4001
   ```

4. Przetestuj komendę przez frontend lub API

