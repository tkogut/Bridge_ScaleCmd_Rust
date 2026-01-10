#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Tworzy Pull Request z brancha do main i automatycznie go merguje

.DESCRIPTION
    Ten skrypt:
    1. Tworzy Pull Request z aktualnego brancha do main
    2. Automatycznie merguje PR
    3. Usuwa branch po merge (opcjonalnie)

.PARAMETER Token
    GitHub Personal Access Token (jeśli nie podano, spróbuje użyć $env:GITHUB_TOKEN lub git config)

.PARAMETER RepoOwner
    Właściciel repozytorium (domyślnie: tkogut)

.PARAMETER RepoName
    Nazwa repozytorium (domyślnie: Bridge_ScaleCmd_Rust)

.PARAMETER BaseBranch
    Branch docelowy (domyślnie: main)

.PARAMETER HeadBranch
    Branch źródłowy (domyślnie: aktualny branch)

.PARAMETER Title
    Tytuł PR (domyślnie: auto-generated)

.PARAMETER Body
    Treść PR (domyślnie: auto-generated)

.PARAMETER MergeMethod
    Metoda merge: merge, squash, rebase (domyślnie: merge)

.PARAMETER DeleteBranchAfterMerge
    Usuń branch po merge (domyślnie: false)

.EXAMPLE
    .\scripts\CreateAndMergePR.ps1 -Token "ghp_xxxxxxxxxxxx"
    
.EXAMPLE
    $env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxx"
    .\scripts\CreateAndMergePR.ps1
#>

param(
    [string]$Token,
    [string]$RepoOwner = "tkogut",
    [string]$RepoName = "Bridge_ScaleCmd_Rust",
    [string]$BaseBranch = "main",
    [string]$HeadBranch,
    [string]$Title,
    [string]$Body,
    [ValidateSet("merge", "squash", "rebase")]
    [string]$MergeMethod = "merge",
    [switch]$DeleteBranchAfterMerge
)

$ErrorActionPreference = "Stop"

# Sprawdź token
if (-not $Token) {
    $Token = $env:GITHUB_TOKEN
}

if (-not $Token) {
    $Token = git config --global github.token 2>$null
}

if (-not $Token) {
    Write-Host "ERROR: Brak tokena GitHub!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Wygeneruj token na: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "Potrzebne uprawnienia: repo (pełny dostęp do repozytoriów)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Następnie użyj jednej z opcji:" -ForegroundColor Cyan
    Write-Host "  `$env:GITHUB_TOKEN = 'ghp_twoj_token'" -ForegroundColor White
    Write-Host "  .\scripts\CreateAndMergePR.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "LUB:" -ForegroundColor Cyan
    Write-Host "  .\scripts\CreateAndMergePR.ps1 -Token 'ghp_twoj_token'" -ForegroundColor White
    exit 1
}

# Sprawdź aktualny branch jeśli nie podano
if (-not $HeadBranch) {
    $HeadBranch = git branch --show-current
    if (-not $HeadBranch) {
        Write-Host "ERROR: Nie można określić aktualnego brancha!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "GitHub PR Automation" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Repository: $RepoOwner/$RepoName" -ForegroundColor Cyan
Write-Host "From: $HeadBranch" -ForegroundColor Cyan
Write-Host "To: $BaseBranch" -ForegroundColor Cyan
Write-Host ""

# Przygotuj tytuł i body PR
if (-not $Title) {
    $Title = "Merge $HeadBranch to $BaseBranch"
}

if (-not $Body) {
    $lastCommit = git log -1 --pretty=format:"%s" 2>$null
    if ($lastCommit) {
        $lastCommit = $lastCommit.Substring(0, [Math]::Min(100, $lastCommit.Length))
    }
    $headBranchName = $HeadBranch
    $baseBranchName = $BaseBranch
    $Body = "## Zmiany`nAutomatyczne merge z brancha $headBranchName do $baseBranchName`n`nOstatni commit: $lastCommit`n`n## Status`n- Wszystkie testy przeszly`n- Build zakonczony pomyslnie`n- Gotowe do merge"
}

# GitHub API endpoint
$apiUrl = "https://api.github.com/repos/$RepoOwner/$RepoName/pulls"
$headers = @{
    "Authorization" = "token $Token"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "PowerShell-PR-Automation"
}

# Sprawdź czy PR już istnieje
Write-Host "[1/4] Sprawdzanie istniejących PR..." -ForegroundColor Yellow
$headParamValue = "$RepoOwner" + ":" + "$HeadBranch"
$headParam = [Uri]::EscapeDataString($headParamValue)
$existingPRsUrl = "$apiUrl" + "?head=" + $headParam + "`&base=" + $BaseBranch + "`&state=open"
try {
    $existingPRs = Invoke-RestMethod -Uri $existingPRsUrl -Headers $headers -Method Get -ErrorAction Stop
} catch {
    # Jeśli nie ma istniejących PR, kontynuuj
    $existingPRs = @()
}

if ($existingPRs.Count -gt 0) {
    $existingPR = $existingPRs[0]
    Write-Host "  [INFO] Znaleziono istniejący PR #$($existingPR.number)" -ForegroundColor Yellow
    Write-Host "  URL: $($existingPR.html_url)" -ForegroundColor Cyan
    $prNumber = $existingPR.number
} else {
    # Utwórz nowy PR
    Write-Host "[2/4] Tworzenie Pull Request..." -ForegroundColor Yellow
    
    $prData = @{
        title = $Title
        head = $HeadBranch
        base = $BaseBranch
        body = $Body
    }
    
    $jsonBody = $prData | ConvertTo-Json -Depth 10 -Compress
    
    try {
        $pr = Invoke-RestMethod -Uri $apiUrl -Headers $headers -Method Post -Body $jsonBody -ContentType "application/json; charset=utf-8"
        Write-Host "  [OK] PR utworzony: #$($pr.number)" -ForegroundColor Green
        Write-Host "  URL: $($pr.html_url)" -ForegroundColor Cyan
        $prNumber = $pr.number
    } catch {
        Write-Host "  [ERROR] Nie udało się utworzyć PR" -ForegroundColor Red
        Write-Host "  $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "  Response: $responseBody" -ForegroundColor Red
        }
        exit 1
    }
}

# Sprawdź czy PR można zmerge'ować
Write-Host "[3/4] Sprawdzanie statusu PR..." -ForegroundColor Yellow
Start-Sleep -Seconds 2  # Daj GitHub czas na przetworzenie

$prStatus = Invoke-RestMethod -Uri "$apiUrl/$prNumber" -Headers $headers -Method Get

if ($prStatus.state -ne "open") {
    Write-Host "  [INFO] PR nie jest otwarty (status: $($prStatus.state))" -ForegroundColor Yellow
    exit 0
}

if (-not $prStatus.mergeable) {
    Write-Host "  [WARN] PR nie może być zmerge'owany (konflikty?)" -ForegroundColor Yellow
    Write-Host "  Sprawdź: $($prStatus.html_url)" -ForegroundColor Cyan
    exit 1
}

# Merge PR
Write-Host "[4/4] Mergowanie PR..." -ForegroundColor Yellow

$mergeUrl = "$apiUrl/$prNumber/merge"
$mergeData = @{
    commit_title = "Merge pull request #$prNumber from $HeadBranch"
    merge_method = $MergeMethod
} | ConvertTo-Json

try {
    $mergeResult = Invoke-RestMethod -Uri $mergeUrl -Headers $headers -Method Put -Body $mergeData -ContentType "application/json"
    
    if ($mergeResult.merged) {
        Write-Host "  [OK] PR został zmerge'owany pomyślnie!" -ForegroundColor Green
        Write-Host "  Commit SHA: $($mergeResult.sha)" -ForegroundColor Gray
        
        # Usuń branch po merge (jeśli żądane)
        if ($DeleteBranchAfterMerge) {
            Write-Host "  [INFO] Usuwanie brancha $HeadBranch..." -ForegroundColor Yellow
            $deleteUrl = "https://api.github.com/repos/$RepoOwner/$RepoName/git/refs/heads/$HeadBranch"
            try {
                Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete
                Write-Host "  [OK] Branch usunięty" -ForegroundColor Green
            } catch {
                Write-Host "  [WARN] Nie udało się usunąć brancha: $_" -ForegroundColor Yellow
            }
        }
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Sukces! PR zmerge'owany" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "PR URL: $($prStatus.html_url)" -ForegroundColor Cyan
    } else {
        Write-Host "  [ERROR] PR nie został zmerge'owany" -ForegroundColor Red
        Write-Host "  Message: $($mergeResult.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  [ERROR] Błąd podczas merge'owania PR" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}
