# Multi-Agent Orchestration - Instrukcje dla Agentów

## Setup Completed ✅

Coordinator Agent zainicjalizował strukturę coordination. Możesz teraz uruchomić pozostałych agentów.

---

## Jak uruchomić agentów

### 1. Otwórz 5 okien Cursor

#### Okno 1: Coordinator Agent (TO OKNO)
- **Folder:** `C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust`
- **Rola:** Monitoruje postępy, rozwiązuje konflikty, finalny build
- **Status:** `coordination/status.json`

#### Okno 2: Backend Agent
- **Folder:** `C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust\src-rust`
- **Rola:** Implementacja MQTT history i API endpoints
- **Status:** `coordination/backend-status.json`
- **Zadania:** B1, B2, B3, B4

#### Okno 3: Frontend Agent
- **Folder:** `C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust\src`
- **Rola:** MQTT Monitor UI w React
- **Status:** `coordination/frontend-status.json`
- **Zadania:** F1, F2, F3, F4
- **Blokada:** Czeka na Backend (B1-B3)

#### Okno 4: Infrastructure Agent
- **Folder:** `C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust\scripts`
- **Rola:** Firewall rules, versioning, installer
- **Status:** `coordination/infra-status.json`
- **Zadania:** I1, I2, I3, I4, I5, I6

#### Okno 5: Testing Agent
- **Folder:** `C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust`
- **Rola:** Testy backend/E2E i dokumentacja
- **Status:** `coordination/testing-status.json`
- **Zadania:** T1, T2, T3, T4, T5, T6, T7, T8

---

## Instrukcje dla każdego agenta

### BACKEND AGENT (Okno 2)

**Prompt startowy:**
```
Jestem Backend Agent w projekcie ScaleIT Bridge Release 0.2.0. 
Przeczytaj plan z @PLAN_MQTT_RELEASE_0.2.0.md oraz mój status z @coordination/backend-status.json.

Moje zadania:
- B1: Dodać moduł history do mqtt/mod.rs
- B2: Stworzyć mqtt/history.rs z MqttHistory struct
- B3: Dodać endpointy MQTT do main.rs
- B4: Zaktualizować MQTT_QUICKSTART.md

Zacznij od B1. Po każdym zadaniu aktualizuj coordination/backend-status.json.

WAŻNE: NIE używaj cargo build - tylko test-rust-mingw.ps1 dla testów.
```

---

### FRONTEND AGENT (Okno 3)

**Prompt startowy:**
```
Jestem Frontend Agent w projekcie ScaleIT Bridge Release 0.2.0.
Przeczytaj plan z @PLAN_MQTT_RELEASE_0.2.0.md oraz mój status z @coordination/frontend-status.json.

Moje zadania:
- F1: Stworzyć MqttMonitor.tsx component
- F2: Stworzyć Mqtt.tsx page
- F3: Dodać routing /mqtt w App.tsx
- F4: Dodać link w SidebarNav.tsx

UWAGA: Jestem zablokowany przez Backend Agent. 
Sprawdź coordination/backend-status.json - czekam aż B1-B3 będą completed.

Kiedy Backend zakończy B3, zacznij od F1.
Po każdym zadaniu aktualizuj coordination/frontend-status.json.
```

---

### INFRASTRUCTURE AGENT (Okno 4)

**Prompt startowy:**
```
Jestem Infrastructure Agent w projekcie ScaleIT Bridge Release 0.2.0.
Przeczytaj plan z @PLAN_MQTT_RELEASE_0.2.0.md oraz mój status z @coordination/infra-status.json.

Moje zadania:

Faza 1 (firewall):
- I1: Zweryfikować konfigurację Mosquitto w Start-Mosquitto-Task.ps1
- I2: Dodać firewall rule do INSTALL-SERVICE.bat
- I3: Dodać usuwanie firewall rule do UNINSTALL-SERVICE.bat

Faza 2 (versioning - później):
- I4: Zaktualizować wersję w Cargo.toml
- I5: Zaktualizować wersję w package.json
- I6: Zaktualizować CHANGELOG.md

Zacznij od I1. Mogę pracować równolegle z innymi agentami.
Po każdym zadaniu aktualizuj coordination/infra-status.json.
```

---

### TESTING AGENT (Okno 5)

**Prompt startowy:**
```
Jestem Testing Agent w projekcie ScaleIT Bridge Release 0.2.0.
Przeczytaj plan z @PLAN_MQTT_RELEASE_0.2.0.md oraz mój status z @coordination/testing-status.json.

Moje zadania:

Faza 1 (dokumentacja - niezależna):
- T1: Stworzyć MQTT_NETWORK_TESTING.md
- T2: Stworzyć MQTT_SECURITY.md

Faza 2 (testy - czeka na Backend):
- T3: Stworzyć mqtt_integration_test.rs
- T4: Uruchomić test-rust-mingw.ps1
- T5: E2E tests (opcjonalnie)

Faza 3 (dokumentacja - czeka na Backend+Frontend):
- T6: Stworzyć USER_GUIDE.md
- T7: Stworzyć API_REFERENCE.md
- T8: Zaktualizować README.md

Zacznij od T1-T2 (mogę robić równolegle).
Po każdym zadaniu aktualizuj coordination/testing-status.json.

WAŻNE: Do testów używaj test-rust-mingw.ps1, NIE cargo test.
```

---

## Protokół komunikacji

### Po zakończeniu zadania:

1. Zaktualizuj swój plik statusu:
```json
{
  "agent": "backend",
  "status": "in_progress",
  "current_task": "b2_history_implementation",
  "completed_tasks": ["b1_mqtt_history_module"],
  "blocked_by": [],
  "provides_for": ["frontend", "testing"],
  "last_update": "2026-01-14T12:30:00Z",
  "notes": "B1 completed. History module declared in mqtt/mod.rs. Starting B2."
}
```

2. Jeśli zakończyłeś wszystkie swoje zadania z fazy:
```json
{
  "status": "completed",
  "current_task": null,
  "notes": "All tasks completed. Ready for next phase."
}
```

3. Jeśli napotkałeś bloker:
   - Zaktualizuj swój status: `"status": "blocked"`
   - Dodaj wpis do `coordination/blockers.json`
   - Napisz notatkę w swoim pliku statusu

---

## Coordinator monitoring

Coordinator Agent (Okno 1) będzie okresowo sprawdzać statusy:

```powershell
# Sprawdź wszystkie statusy
Get-Content coordination/*.json | ConvertFrom-Json

# Lub w jednym:
Get-ChildItem coordination/*.json | ForEach-Object {
    Write-Host "`n=== $($_.Name) ===" -ForegroundColor Cyan
    Get-Content $_.FullName | ConvertFrom-Json | Format-List
}
```

---

## Diagram przepływu

```
START
  │
  ├─ Backend Agent → B1, B2, B3 (równolegle z Infrastructure i Testing docs)
  │
  ├─ Infrastructure Agent → I1, I2, I3 (równolegle)
  │
  └─ Testing Agent → T1, T2 (równolegle)
  
CHECKPOINT 1: Backend B1-B3 completed
  │
  ├─ Frontend Agent → F1, F2, F3, F4 (teraz może zacząć)
  │
  └─ Backend Agent → B4 (update docs)
  
CHECKPOINT 2: Backend + Frontend completed
  │
  └─ Testing Agent → T3, T4, T5 (testy)
  
CHECKPOINT 3: Testy completed
  │
  └─ Testing Agent → T6, T7, T8 (finalna dokumentacja)
  
CHECKPOINT 4: Wszystko completed
  │
  ├─ Infrastructure Agent → I4, I5, I6 (versioning)
  │
  └─ Coordinator Agent → C1, C2, C3 (build & release)
  
END
```

---

## Kolejne kroki

1. **TY (Coordinator):** Otwórz 4 nowe okna Cursor
2. **W każdym nowym oknie:** Wklej odpowiedni "Prompt startowy" z powyższych instrukcji
3. **Monitoruj:** Sprawdzaj pliki statusu co ~15 min
4. **Koordynuj:** Rozwiązuj konflikty, komunikuj między agentami
5. **Finalizuj:** Gdy wszystko completed → C1, C2, C3

---

**Powodzenia! 🚀**

Coordinator Agent jest gotowy do monitorowania.
