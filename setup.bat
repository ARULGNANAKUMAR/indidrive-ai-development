@echo off
REM One dependency install for the whole merged project (Windows).
setlocal
cd /d "%~dp0"

python -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo pip install failed - see the error above.
    exit /b 1
)

echo.
echo NOTE: the 'carla' Python package itself is NOT installed by this step
echo (it isn't a normal PyPI wheel for every platform/version). Install it
echo from your CARLA distribution's PythonAPI folder - see docs\CARLA_SETUP.md.
echo.
echo Done. Next: run.bat
