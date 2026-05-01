# ─── Free Claude Web Launcher (PowerShell) ───────────────
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║       Free Claude Web Launcher        ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProxyDir   = Join-Path $ScriptDir "free-claude-code"
$HtmlFile   = Join-Path $ScriptDir "index.html"
$Port       = 8082

# ── Check proxy repo ─────────────────────────────────────
if (-not (Test-Path $ProxyDir)) {
    Write-Host "  [!] Proxy repo not found at: $ProxyDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Run these commands first:"
    Write-Host "    git clone https://github.com/Alishahryar1/free-claude-code.git"
    Write-Host "    cd free-claude-code; Copy-Item .env.example .env"
    Write-Host "    # Edit .env with your API key"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Check uv ─────────────────────────────────────────────
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "  [!] 'uv' not found. Install it:" -ForegroundColor Red
    Write-Host "    powershell -ExecutionPolicy ByPass -c `"irm https://astral.sh/uv/install.ps1 | iex`""
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Check if already running ─────────────────────────────
$running = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "  [✓] Proxy already running on port $Port" -ForegroundColor Green
} else {
    Write-Host "  [→] Starting proxy on port $Port..." -ForegroundColor Yellow
    Set-Location $ProxyDir
    $proxy = Start-Process -FilePath "uv" -ArgumentList "run uvicorn server:app --host 0.0.0.0 --port $Port" -PassThru -WindowStyle Hidden
    Write-Host "  [✓] Proxy started (PID: $($proxy.Id))" -ForegroundColor Green
    Write-Host "  [i] Waiting for startup..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
}

# ── Open browser ─────────────────────────────────────────
Write-Host "  [→] Opening web interface..." -ForegroundColor Yellow
Start-Process $HtmlFile

Write-Host ""
Write-Host "  [✓] Free Claude Web is running!" -ForegroundColor Green
Write-Host "  [i] Proxy: http://localhost:$Port" -ForegroundColor Gray
Write-Host "  [i] Close this window to stop the proxy." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit"
