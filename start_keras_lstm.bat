@echo off
echo ===================================================================
echo Starting SteelTrack Keras LSTM Demand Forecasting Service
echo Host: http://127.0.0.1:8000  (Docs: http://localhost:8000/docs)
echo ===================================================================
venv\Scripts\python.exe -m uvicorn ml.server:app --host 0.0.0.0 --port 8000

