Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "Starting SteelTrack Keras LSTM Demand Forecasting Service" -ForegroundColor Cyan
Write-Host "Host: http://127.0.0.1:8000  (Docs: http://localhost:8000/docs)" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Cyan
& "venv\Scripts\python.exe" -m uvicorn ml.server:app --host 0.0.0.0 --port 8000

