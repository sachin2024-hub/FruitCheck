@echo off
rem Double-click to start the FruitCheck backend on port 8000.
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo .venv not found. Create it first:
    echo   python -m venv .venv
    echo   .venv\Scripts\python.exe -m pip install -r requirements.txt
    pause
    exit /b 1
)

echo Starting FruitCheck backend at http://localhost:8000  (health: /health)
echo Close this window or press Ctrl+C to stop.
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000

rem Keep the window open if the server stops or fails so the error stays visible.
pause
