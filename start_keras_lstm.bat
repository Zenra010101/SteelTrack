@echo off
setlocal
echo ===================================================================
echo Starting SteelTrack Keras LSTM Demand Forecasting Service
echo Host: http://127.0.0.1:8000  (Docs: http://localhost:8000/docs)
echo ===================================================================

:: Ensure venv exists and uses Python 3.12 (binary packages are compiled for cp312)
if not exist "venv\Scripts\python.exe" (
    echo [INFO] Virtual environment not found. Creating venv with Python 3.12...
    py -3.12 -m venv venv
    venv\Scripts\python.exe -m pip install -r requirements-ml.txt
)

:: Verify python version inside venv
for /f "tokens=2 delims= " %%v in ('venv\Scripts\python.exe --version 2^>^&1') do set VENV_PY_VER=%%v
echo %VENV_PY_VER% | findstr /b "3.12" >nul
if errorlevel 1 (
    echo [WARN] venv Python version is %VENV_PY_VER% (expected 3.12). Re-binding venv to Python 3.12...
    py -3.12 -m venv --upgrade venv
)

venv\Scripts\python.exe -m uvicorn ml.server:app --host 0.0.0.0 --port 8000


