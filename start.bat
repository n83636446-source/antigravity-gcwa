@echo off
title StockPilot - Starting Servers...
cd /d "%~dp0"

echo.
echo  ==========================================
echo    StockPilot - Starting Servers
echo  ==========================================
echo.

echo [1/2] Starting FastAPI Backend on port 8000...
start "StockPilot Backend" cmd /k "python-embed\Scripts\uvicorn.exe backend.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Next.js Frontend on port 9002...
start "StockPilot Frontend" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo  ==========================================
echo    Servers are starting up!
echo  ==========================================
echo.
echo   Web App:  http://localhost:9002
echo   API Docs: http://localhost:8000/docs
echo.
echo  Opening browser in 5 seconds...
timeout /t 5 /nobreak >nul
start http://localhost:9002

exit
