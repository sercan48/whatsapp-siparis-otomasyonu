@echo off
echo ============================================
echo    n8n Local Setup - Quick Start Script
echo ============================================
echo.

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] ngrok is installed
) else (
    echo [!] ngrok NOT installed
    echo.
    echo Installing ngrok with Chocolatey...
    echo If you don't have Chocolatey, download ngrok from: https://ngrok.com/download
    echo.
    choco install ngrok -y
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install ngrok
        echo Please install manually from https://ngrok.com/download
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo    Step 1: Starting ngrok tunnel
echo ============================================
echo.
echo ngrok will create a public HTTPS URL for your local n8n
echo Copy the https://xxxxx.ngrok.io URL when it appears
echo.
echo Starting ngrok on port 5678...
echo.

start "ngrok" cmd /k ngrok http 5678

timeout /t 3 >nul

echo.
echo ============================================
echo    Step 2: Next Steps
echo ============================================
echo.
echo 1. Check the ngrok window for your HTTPS URL (like https://abc123.ngrok.io)
echo 2. Open n8n at http://localhost:5678
echo 3. Go to Settings -^> Variables and add environment variables from .env.n8n
echo 4. Import workflows from backend/workflows/*.json
echo 5. Update Meta webhook with your ngrok URL + /webhook/whatsapp-webhook
echo.
echo Full guide: backend/workflows/LOCAL_SETUP_GUIDE.md
echo.
pause
