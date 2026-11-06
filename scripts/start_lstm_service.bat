@echo off
rem -------------------------------------------------------
rem SteelTrack LSTM Forecast Service Launcher
rem Starts the Python FastAPI service in the background
rem -------------------------------------------------------

rem Change to the directory where this script resides
cd /d "%~dp0"

rem Verify Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not on PATH.
    echo Please install Python 3.11+ and ensure it is on your PATH.
    pause
    exit /b 1
)

rem Verify the LSTM source directory exists
if not exist "..\python-lstm-service\src\main.py" (
    echo ERROR: LSTM source directory not found relative to script location.
    pause
    exit /b 1
)

rem Activate the virtual environment if present
if exist "..\python-lstm-service\.venv\Scripts\activate.bat" (
    call "..\python-lstm-service\.venv\Scripts\activate.bat"
    echo Virtual environment activated.
) else (
    echo No virtual environment found at ..\python-lstm-service\.venv\Scripts\activate.bat
    echo Installing dependencies from pyproject.toml...
    pip install -q ..\python-lstm-service\ 2>nul || echo Note: pip install may need to run once.
)

rem Start the FastAPI server
echo Starting SteelTrack LSTM Forecast Service...
echo Service will be available at http://localhost:8000
echo API key header: X-LSTM-API-KEY
echo .
start /b python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload-log 2>&1 >> lstm-service.log

echo LSTM service startup initiated. Check lstm-service.log for details.
echo To stop this service, close this window or kill the uvicorn process.
