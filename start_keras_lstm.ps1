Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "Starting SteelTrack Keras LSTM Demand Forecasting Service" -ForegroundColor Cyan
Write-Host "Host: http://127.0.0.1:8000  (Docs: http://localhost:8000/docs)" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Cyan

# Ensure venv exists and runs on Python 3.12 (binary packages are compiled for cp312)
if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "[INFO] Virtual environment not found. Creating venv with Python 3.12..." -ForegroundColor Yellow
    py -3.12 -m venv venv
    & "venv\Scripts\python.exe" -m pip install -r requirements-ml.txt
}

$pyVer = & "venv\Scripts\python.exe" --version 2>&1
if ($pyVer -notmatch "3\.12\.") {
    Write-Host "[WARN] venv is running on $pyVer (expected 3.12). Upgrading venv to Python 3.12..." -ForegroundColor Yellow
    py -3.12 -m venv --upgrade venv
}

& "venv\Scripts\python.exe" -m uvicorn ml.server:app --host 0.0.0.0 --port 8000


