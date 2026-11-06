#!/bin/bash
# -------------------------------------------------------
# SteelTrack LSTM Forecast Service Launcher
# Starts the Python FastAPI service in the background
# -------------------------------------------------------

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Verify Python is available
if ! python --version >/dev/null 2>&1; then
    echo "ERROR: Python is not installed or not on PATH."
    echo "Please install Python 3.11+ and ensure it is on your PATH."
    exit 1
fi

# Verify the LSTM source directory exists
if [ ! -f "$REPO_ROOT/python-lstm-service/src/main.py" ]; then
    echo "ERROR: LSTM source directory not found relative to script location."
    exit 1
fi

# Activate the virtual environment if present
if [ -f "$REPO_ROOT/python-lstm-service/.venv/bin/activate" ]; then
    source "$REPO_ROOT/python-lstm-service/.venv/bin/activate"
    echo "Virtual environment activated."
else
    echo "No virtual environment found at ..python-lstm-service/.venv/bin/activate"
    echo "Installing dependencies from pyproject.toml..."
    pip install -q "$REPO_ROOT/python-lstm-service/" 2>/dev/null || echo "Note: pip install may need to run once."
fi

# Start the FastAPI server
echo "Starting SteelTrack LSTM Forecast Service..."
echo "Service will be available at http://localhost:8000"
echo "API key header: X-LSTM-API-KEY"
echo ""

# Use nohup to run in background, redirect stdout/stderr to log file
cd "$REPO_ROOT/python-lstm-service"
nohup python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload-log 2>&1 >> lstm-service.log 2>&1 &

# Get the PID of the uvicorn process
PID=$!
echo "$PID" > uvicorn.pid

echo "LSTM service startup initiated. PID: $PID"
echo "Check lstm-service.log for details."
echo "To stop this service, run: kill $(cat uvicorn.pid) || ./stop_lstm_service.sh"
