# 🔧 Instrukcje dla Infrastructure Agent

## Informacje podstawowe

- **Branch:** `cursor/infrastructure-b355`
- **Status file:** `coordination/infra-status.json`
- **Zadania:** I3, I4, I5, I6

---

## ✅ Ukończone zadania (Faza 1)

- [x] **I1** - Verify Mosquitto configuration ✅
- [x] **I2** - Create coordination infrastructure ✅

---

## 🔴 Zadania do wykonania (Faza 2)

### I3: Update Inno Setup Installer (PRIORYTET WYSOKI)

**Plik:** `installer/ScaleCmdBridge.iss`

**Wymagane zmiany:**

1. Dodaj checkbox "Enable MQTT on startup" w sekcji instalacji
2. Dodaj zmienne środowiskowe MQTT jeśli checkbox zaznaczony:
   - `MQTT_ENABLED=true`
   - `MQTT_BROKER_URL=mqtt://localhost:1883`
   - `MQTT_CLIENT_ID=scaleit-bridge`
   - `MQTT_TOPIC_PREFIX=scaleit`
3. Dodaj sekcję konfiguracji MQTT w post-install

**Przykład kodu Inno Setup:**

```pascal
[Tasks]
Name: "mqttenable"; Description: "Enable MQTT on startup"; GroupDescription: "MQTT Configuration:"; Flags: unchecked

[Registry]
; MQTT environment variables (if MQTT enabled)
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Services\ScaleCmdBridge\Environment"; ValueType: string; ValueName: "MQTT_ENABLED"; ValueData: "true"; Tasks: mqttenable
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Services\ScaleCmdBridge\Environment"; ValueType: string; ValueName: "MQTT_BROKER_URL"; ValueData: "mqtt://localhost:1883"; Tasks: mqttenable
```

---

### I4: Add MQTT to CI/CD (PRIORYTET ŚREDNI)

**Plik:** `.github/workflows/ci-cd.yml`

**Wymagane zmiany:**

1. Dodaj zmienne środowiskowe MQTT dla testów:
   ```yaml
   env:
     MQTT_ENABLED: "false"  # Disabled for CI tests
   ```

2. Opcjonalnie: Dodaj krok uruchomienia Mosquitto dla integration tests:
   ```yaml
   - name: Start Mosquitto (for integration tests)
     run: |
       sudo apt-get install -y mosquitto
       sudo systemctl start mosquitto
   ```

3. Dodaj MQTT health check w testach

---

### I5: MQTT Windows Service Configuration (PRIORYTET ŚREDNI)

**Nowy plik:** `scripts/Configure-MQTT-Service.ps1`

**Funkcjonalność:**

```powershell
# Configure-MQTT-Service.ps1
# Konfiguruje zmienne środowiskowe MQTT dla usługi Windows

param(
    [switch]$Enable,
    [switch]$Disable,
    [string]$BrokerUrl = "mqtt://localhost:1883",
    [string]$ClientId = "scaleit-bridge",
    [string]$TopicPrefix = "scaleit"
)

$serviceName = "ScaleCmdBridge"

if ($Enable) {
    # Set MQTT environment variables via NSSM
    nssm set $serviceName AppEnvironmentExtra +MQTT_ENABLED=true
    nssm set $serviceName AppEnvironmentExtra +MQTT_BROKER_URL=$BrokerUrl
    nssm set $serviceName AppEnvironmentExtra +MQTT_CLIENT_ID=$ClientId
    nssm set $serviceName AppEnvironmentExtra +MQTT_TOPIC_PREFIX=$TopicPrefix
    
    Write-Host "MQTT enabled for $serviceName"
    Restart-Service $serviceName
}

if ($Disable) {
    # Remove MQTT environment variables
    nssm set $serviceName AppEnvironmentExtra -MQTT_ENABLED
    
    Write-Host "MQTT disabled for $serviceName"
    Restart-Service $serviceName
}
```

---

### I6: Update Installation Documentation (PRIORYTET NISKI)

**Plik:** `docs/WINDOWS_INSTALLATION_GUIDE.md`

**Sekcje do dodania:**

1. **MQTT Configuration** - nowa sekcja
   - Wymagania (Mosquitto broker)
   - Konfiguracja podczas instalacji
   - Konfiguracja po instalacji

2. **Mosquitto Installation** - kroki instalacji
   - Download z mosquitto.org
   - Instalacja jako Windows Service
   - Konfiguracja firewall

3. **MQTT Troubleshooting** - rozwiązywanie problemów
   - Sprawdzanie połączenia
   - Logi MQTT
   - Typowe błędy

---

## 📁 Pliki referencyjne

Przeczytaj te pliki przed rozpoczęciem:

- `installer/ScaleCmdBridge.iss` - aktualny installer
- `scripts/Start-Mosquitto-Task.ps1` - konfiguracja Mosquitto
- `scripts/Install-Mosquitto.ps1` - instalacja Mosquitto
- `.github/workflows/ci-cd.yml` - aktualny CI/CD
- `docs/MQTT_INTEGRATION.md` - dokumentacja MQTT
- `docs/MQTT_QUICKSTART.md` - szybki start MQTT

---

## 🔄 Workflow

1. **Checkout branch:**
   ```bash
   git checkout cursor/infrastructure-b355
   git pull origin cursor/infrastructure-b355
   ```

2. **Wykonaj zadania w kolejności:** I3 → I4 → I5 → I6

3. **Po każdym zadaniu:**
   - Aktualizuj `coordination/infra-status.json`
   - Commit z opisowym message
   - Push do branch

4. **Po zakończeniu wszystkich:**
   - Ustaw status na "phase2_completed"
   - Powiadom koordynatora

---

## 📝 Format commit messages

```
infra(mqtt): <opis zmiany>

Przykłady:
- infra(mqtt): Add MQTT checkbox to Inno Setup installer (I3)
- infra(mqtt): Add MQTT environment to CI/CD pipeline (I4)
- infra(mqtt): Create Configure-MQTT-Service.ps1 script (I5)
- infra(mqtt): Update Windows installation guide with MQTT section (I6)
```

---

## ⚠️ Uwagi

1. **NIE używaj** bezpośrednich komend `cargo build` - użyj `scripts/Build-WindowsInstaller.ps1`
2. **Testuj** zmiany w installerze lokalnie przed push
3. **Zachowaj** kompatybilność wsteczną - MQTT powinno być opcjonalne
4. **Dokumentuj** wszystkie zmiany w infra-status.json

---

## 📞 Kontakt

- **Koordynator:** Cursor AI
- **Branch główny:** `main`
- **Release target:** 0.2.0
