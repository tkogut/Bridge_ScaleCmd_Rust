# ScaleIT Bridge Backend Guidelines (Rust)

Niniejszy dokument zawiera wytyczne dotyczące modyfikacji kodu w katalogu `src-rust/`, aby umożliwić dynamiczne zarządzanie konfiguracją urządzeń przez GUI Manager (front-end).

**Cel:** Bridge musi dynamicznie przyjmować, zapisywać i przeładowywać konfigurację urządzeń (w tym host, port, baud rate, komendy) bez konieczności restartu usługi.

---

## 1. Modyfikacja Modeli Danych (`src-rust/src/models/`)

Upewnij się, że struktury danych w Rust są w pełni zgodne z typami `DeviceConfig` używanymi na froncie, w szczególności z dynamicznymi polami połączenia (TCP/Serial).

### 1.1. `src-rust/src/models/device.rs`

Struktury muszą poprawnie obsługiwać oba typy połączeń (`Tcp` i `Serial`) oraz dynamiczne komendy.

```rust
// Przykład struktury DeviceConfig w Rust (wymaga serde::Deserialize)

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "connection_type")]
pub enum Connection {
    Tcp {
        host: String,
        port: u16,
        timeout_ms: u32,
    },
    Serial {
        port: String, // Ścieżka portu (np. COM1, /dev/ttyUSB0)
        baud_rate: u32,
        timeout_ms: u32,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DeviceConfig {
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    pub protocol: String,
    pub connection: Connection,
    pub commands: HashMap<String, String>, // Dynamiczne mapowanie komend
}

// Struktura dla żądania zapisu konfiguracji
#[derive(Debug, Deserialize)]
pub struct SaveConfigRequest {
    pub device_id: String,
    pub config: DeviceConfig,
}
```

---

## 2. Implementacja Endpointu API (Actix-web)

W pliku obsługującym routing (np. `src-rust/src/main.rs` lub dedykowany moduł API) należy dodać nowy endpoint do zapisu konfiguracji.

### 2.1. Dodanie Endpointu Zapisu

W Actix-web, dodaj trasę, która przyjmuje `POST` z ciałem JSON zawierającym `SaveConfigRequest`.

**Endpoint:** `POST /api/config/save`

```rust
// W module Actix-web (np. src-rust/src/main.rs)

#[post("/api/config/save")]
async fn save_device_config(
    req: web::Json<SaveConfigRequest>,
    data: web::Data<AppState>, // Załóżmy, że AppState przechowuje DeviceManager
) -> Result<HttpResponse, Error> {
    // 1. Walidacja i ekstrakcja danych
    let device_id = req.device_id.clone();
    let config = req.config.clone();

    // 2. Zapis do pliku (trwały magazyn)
    // Wymaga implementacji w DeviceManager lub ConfigurationManager
    data.device_manager.save_config(&device_id, config).await?;

    // 3. Przeładowanie konfiguracji w pamięci
    // To jest kluczowe: Bridge musi zacząć używać nowej konfiguracji natychmiast.
    data.device_manager.reload_config().await?; 

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": format!("Configuration for {} saved and reloaded.", device_id)
    })))
}
```

### 2.2. Dodanie Endpointu Usuwania

**Endpoint:** `DELETE /api/config/{device_id}`

```rust
#[delete("/api/config/{device_id}")]
async fn delete_device_config(
    path: web::Path<String>,
    data: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let device_id = path.into_inner();

    // 1. Usunięcie z pliku
    data.device_manager.delete_config(&device_id).await?;

    // 2. Przeładowanie konfiguracji
    data.device_manager.reload_config().await?;

    Ok(HttpResponse::Ok().json(json!({
        "success": true,
        "message": format!("Device {} deleted and configuration reloaded.", device_id)
    })))
}
```

---

## 3. Logika Zarządzania Konfiguracją (`src-rust/src/device_manager.rs`)

Kluczowym elementem jest moduł zarządzający urządzeniami, który musi obsługiwać trwały zapis i przeładowanie.

### 3.1. Implementacja `DeviceManager`

`DeviceManager` musi posiadać metody:

1.  `load_from_file()`: Wczytuje konfigurację z `devices.json`.
2.  `save_to_file()`: Zapisuje aktualny stan konfiguracji do `devices.json`.
3.  `save_config(id, config)`: Aktualizuje wewnętrzną mapę i wywołuje `save_to_file()`.
4.  `delete_config(id)`: Usuwa z wewnętrznej mapy i wywołuje `save_to_file()`.
5.  `reload_config()`: Wywołuje `load_from_file()` i aktualizuje wewnętrzny stan, aby nowe połączenia używały zaktualizowanych danych.

### 3.2. Zastosowanie Dynamicznej Konfiguracji w `/scalecmd`

Gdy Bridge otrzymuje żądanie `POST /scalecmd`, musi użyć **aktualnie załadowanej** konfiguracji z `DeviceManager` do nawiązania połączenia (TCP/Serial) i wysłania komendy.

```rust
// W logice obsługującej /scalecmd

// 1. Pobierz aktualną konfigurację dla device_id
let config = data.device_manager.get_config(&request.device_id)?;

// 2. Użyj dynamicznych parametrów połączenia
match &config.connection {
    Connection::Tcp { host, port, timeout_ms } => {
        // Użyj host, port, timeout_ms do nawiązania połączenia TCP
        let adapter = RinstrumAdapter::new(host, *port, *timeout_ms);
        adapter.execute_command(&config.commands[&request.command]).await
    }
    Connection::Serial { port, baud_rate, timeout_ms } => {
        // Użyj port, baud_rate, timeout_ms do nawiązania połączenia Serial
        // ...
    }
}
```

---

## 4. Aktualizacja Front-endu (Wymagane, aby użyć nowych tras)

Jeśli zaimplementujesz powyższe trasy w Rust, musisz zaktualizować `src/services/bridge-api.ts` na froncie, aby używały tych nowych, realistycznych endpointów zamiast symulacji w `mockDb`.

**Wymagane zmiany w `src/services/bridge-api.ts` (po implementacji backendu):**

```typescript
// Zamiast używać mockDb:
export async function saveDeviceConfig(
  deviceId: DeviceId,
  config: DeviceConfig,
): Promise<void> {
  const response = await fetch(`${BRIDGE_URL}/api/config/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, config }),
  });
  if (!response.ok) {
    throw new Error("Failed to save configuration via Bridge API.");
  }
}

export async function deleteDeviceConfig(deviceId: DeviceId): Promise<void> {
  const response = await fetch(`${BRIDGE_URL}/api/config/${deviceId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete configuration via Bridge API.");
  }
}
```

Te wytyczne powinny wystarczyć do zaimplementowania dynamicznej konfiguracji w backendzie Bridge.