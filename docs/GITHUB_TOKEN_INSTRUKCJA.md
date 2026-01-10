# Instrukcja: Generowanie Tokena GitHub

## Krok po kroku:

1. **Zaloguj się na GitHub.com**

2. **Przejdź do ustawień**:
   - Kliknij na ikonę profilu (prawy górny róg)
   - Wybierz **Settings** (Ustawienia)

3. **Otwórz Developer Settings**:
   - W lewym menu przewiń w dół
   - Kliknij **Developer settings**

4. **Utwórz Personal Access Token**:
   - Kliknij **Personal access tokens** → **Tokens (classic)**
   - Kliknij **Generate new token** → **Generate new token (classic)**

5. **Skonfiguruj token**:
   - **Note**: `ScaleCmdBridge PR Automation` (lub dowolna nazwa)
   - **Expiration**: Wybierz okres ważności (np. 90 dni lub No expiration)
   - **Scopes** - zaznacz:
     - ✅ **repo** (pełny dostęp do repozytoriów - potrzebne do PR)
     - ✅ **workflow** (jeśli używasz GitHub Actions)

6. **Wygeneruj i skopiuj**:
   - Kliknij **Generate token**
   - **WAŻNE**: Skopiuj token natychmiast! Pokaże się tylko raz.
   - Przykład tokena: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Użycie tokena:

### Opcja 1: Zmienna środowiskowa (tymczasowa)
```powershell
$env:GITHUB_TOKEN = "ghp_twoj_token_tutaj"
```

### Opcja 2: Zapisanie w git config (trwałe)
```powershell
git config --global github.token "ghp_twoj_token_tutaj"
```

### Opcja 3: Zapisanie w pliku (tylko lokalnie, nie commituj!)
```powershell
# Utwórz plik .github_token (dodaj do .gitignore!)
"ghp_twoj_token_tutaj" | Out-File -FilePath .github_token -Encoding utf8 -NoNewline
```

## Bezpieczeństwo:

⚠️ **NIGDY nie commituj tokena do repozytorium!**
- Dodaj `.github_token` do `.gitignore`
- Token jest jak hasło - trzymaj go w tajemnicy
- Jeśli token wycieknie, natychmiast go usuń na GitHubie
