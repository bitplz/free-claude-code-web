@echo off
:: ─── Free Claude Web Launcher (Windows) ──────────────────
title Free Claude Web Launcher
echo.
echo   ╔═══════════════════════════════════════╗
echo   ║       Free Claude Web Launcher        ║
echo   ╚═══════════════════════════════════════╝
echo.

set SCRIPT_DIR=%~dp0
set PROXY_DIR=%SCRIPT_DIR%free-claude-code
set HTML_FILE=%SCRIPT_DIR%index.html
set PORT=8082

:: ── Check proxy repo ──────────────────────────────────────
if not exist "%PROXY_DIR%" (
    echo   [!] Proxy repo not found at: %PROXY_DIR%
    echo.
    echo   Run these commands first:
    echo     git clone https://github.com/Alishahryar1/free-claude-code.git
    echo     cd free-claude-code ^&^& copy .env.example .env
    echo     REM Edit .env with your API key
    echo.
    pause
    exit /b 1
)

:: ── Check uv ──────────────────────────────────────────────
where uv >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [!] 'uv' not found. Install it via PowerShell:
    echo     powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 ^| iex"
    pause
    exit /b 1
)

:: ── Check if already running ──────────────────────────────
netstat -an | find ":%PORT% " | find "LISTENING" >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo   [✓] Proxy already running on port %PORT%
    goto OPEN_BROWSER
)

:: ── Start proxy ───────────────────────────────────────────
echo   [→] Starting proxy on port %PORT%...
cd /d "%PROXY_DIR%"
start /B uv run uvicorn server:app --host 0.0.0.0 --port %PORT%
echo   [✓] Proxy started in background
echo   [i] Waiting for startup...
timeout /t 3 /nobreak >nul

:OPEN_BROWSER
:: ── Open browser ──────────────────────────────────────────
echo   [→] Opening web interface...
start "" "%HTML_FILE%"

echo.
echo   [✓] Free Claude Web is running!
echo   [i] Proxy: http://localhost:%PORT%
echo   [i] Close this window to stop.
echo.
pause
