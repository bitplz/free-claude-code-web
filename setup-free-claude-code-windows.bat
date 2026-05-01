@echo off
echo =====================================
echo Free Claude Code - Windows Setup
echo =====================================

:: Install uv
echo Installing uv...
powershell -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"

:: Refresh PATH (important)
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

:: Update uv
echo Updating uv...
uv self update

:: Install Python 3.14
echo Installing Python 3.14...
uv python install 3.14

:: Clone repo
echo Cloning repository...
git clone https://github.com/Alishahryar1/free-claude-code.git
cd free-claude-code

:: Create .env file
echo Creating .env file...
copy .env.example .env

echo =====================================
echo Setup Complete!
echo =====================================
echo.
echo 👉 NEXT STEP (IMPORTANT):
echo 1. Open .env file
echo 2. Add your API key
echo.
pause

:: Start server
echo Starting proxy server...
uv run uvicorn server:app --host 0.0.0.0 --port 8082

pause