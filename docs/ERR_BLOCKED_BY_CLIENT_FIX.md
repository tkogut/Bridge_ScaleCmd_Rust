# Fix: ERR_BLOCKED_BY_CLIENT Error

## Problem
Błąd `ERR_BLOCKED_BY_CLIENT` przy próbie połączenia z `http://localhost:8080/health`

## Przyczyny

### 1. AdBlocker lub rozszerzenie przeglądarki
AdBlocker lub inne rozszerzenia mogą blokować requesty do `localhost`.

**Rozwiązanie:**
- Wyłącz AdBlocker dla `localhost:8080`
- Wyłącz rozszerzenia przeglądarki (Privacy Badger, uBlock Origin, etc.)
- Użyj trybu incognito/privatny

### 2. Mixed Content (HTTPS → HTTP)
Jeśli frontend jest na Vercel (HTTPS), a próbuje połączyć się z `localhost:8080` (HTTP), przeglądarka zablokuje to jako mixed content.

**Rozwiązanie:**
- Użyj `http://` zamiast `https://` na Vercel (jeśli możliwe)
- Lub użyj tunelu HTTPS (ngrok, Cloudflare Tunnel) dla Bridge
- Lub uruchom frontend lokalnie: `npm run dev`

### 3. Polityka bezpieczeństwa przeglądarki
Niektóre przeglądarki blokują requesty do `localhost` z zewnętrznych stron.

**Rozwiązanie:**
- Użyj IP komputera zamiast `localhost`: `http://192.168.1.100:8080`
- Upewnij się, że Bridge nasłuchuje na `0.0.0.0:8080` (już tak jest)

### 4. Sprawdź czy Bridge działa
```powershell
# Sprawdź czy port 8080 jest otwarty
netstat -ano | findstr :8080

# Sprawdź czy Bridge odpowiada
curl http://localhost:8080/health
```

## Szybkie rozwiązanie

1. **Wyłącz AdBlocker** dla `localhost:8080`
2. **Użyj trybu incognito** przeglądarki
3. **Sprawdź w DevTools** (F12) → Network tab, czy request jest blokowany
4. **Użyj IP zamiast localhost** w `bridge-api.ts`:
   ```typescript
   const BRIDGE_URL = "http://127.0.0.1:8080"; // zamiast localhost
   ```

## Dla Vercel

Jeśli frontend jest na Vercel, musisz:
1. Użyć tunelu HTTPS (ngrok, Cloudflare Tunnel) dla Bridge
2. Lub uruchomić frontend lokalnie: `npm run dev`
3. Lub użyć IP komputera (tylko jeśli Vercel i Bridge są w tej samej sieci)

