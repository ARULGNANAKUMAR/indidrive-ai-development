@echo off
REM IndiDrive AI - unified project, single-process launcher (Windows).
REM Starts ONE server on ONE port (8004) serving the product platform
REM at / and the legacy canvas simulator at /simulator.
setlocal
cd /d "%~dp0"

if "%PORT%"=="" set PORT=8004

echo Starting IndiDrive AI on http://localhost:%PORT%
echo   Product platform: http://localhost:%PORT%/
echo   Legacy simulator: http://localhost:%PORT%/simulator/
echo   API docs:         http://localhost:%PORT%/api/docs
echo.
python -m uvicorn api.server:app --host 0.0.0.0 --port %PORT%
