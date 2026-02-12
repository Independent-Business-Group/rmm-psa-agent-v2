@echo off
REM EverydayTech Agent v2 - Windows Installation Script
REM Run as Administrator

echo Installing EverydayTech Agent v2...
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

REM Check if source files exist
echo Checking source files...
if not exist "EverydayTechAgent-v2-win.exe" (
    echo ERROR: EverydayTechAgent-v2-win.exe not found in current directory
    echo Current directory: %CD%
    echo.
    echo Please make sure you:
    echo 1. Extracted the agent-v2-windows-deployment.zip file
    echo 2. Are running install.bat from the extracted folder
    echo.
    dir /B
    pause
    exit /b 1
)

if not exist "helpers" (
    echo ERROR: helpers folder not found in current directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo Creating directories...
mkdir "C:\Program Files\EverydayTech\Agent" 2>nul
mkdir "C:\Program Files\EverydayTech\Agent\helpers" 2>nul
mkdir "C:\ProgramData\EverydayTech\logs" 2>nul
mkdir "C:\ProgramData\EverydayTech\config" 2>nul

echo Copying agent files...
echo From: %CD%\EverydayTechAgent-v2-win.exe
echo To: C:\Program Files\EverydayTech\Agent\EverydayTechAgent-v2.exe
copy /Y EverydayTechAgent-v2-win.exe "C:\Program Files\EverydayTech\Agent\EverydayTechAgent-v2.exe"
if %errorLevel% neq 0 (
    echo ERROR: Failed to copy agent executable (Error code: %errorLevel%)
    exit /b 1
)

echo Copying helper applications...
copy /Y helpers\*.exe "C:\Program Files\EverydayTech\Agent\helpers\"
if %errorLevel% neq 0 (
    echo ERROR: Failed to copy helper applications
    pause
    exit /b 1
)

echo Creating configuration file...
if not exist "C:\ProgramData\EverydayTech\config\agent-v2.json" (
    (
        echo {
        echo   "version": "2.0.0",
        echo   "backendUrl": "https://rmm-psa-backend-t9f7k.ondigitalocean.app/api",
        echo   "websocketUrl": "wss://rmm-psa-backend-t9f7k.ondigitalocean.app/api/agent/ws",
        echo   "logLevel": "info",
        echo   "helpers": {
        echo     "timeout": 30000,
        echo     "retryAttempts": 2,
        echo     "enabled": ["rdp-helper-v2", "system-helper", "update-helper"]
        echo   },
        echo   "features": {
        echo     "remoteDesktop": true,
        echo     "systemInfo": true
        echo   }
        echo }
    ) > "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo Configuration file created
) else (
    echo Configuration file already exists, skipping
)

echo.
echo Installing Windows service...
"C:\Program Files\EverydayTech\Agent\EverydayTechAgent-v2.exe" --install-service
if %errorLevel% neq 0 (
    echo ERROR: Failed to install Windows service
    echo This usually means the service is already installed
    echo Try: sc delete "EverydayTech Agent v2"
    echo Then run this installer again
    pause
    exit /b 1
)
echo Service installed successfully

echo.
echo Starting Windows service...
net start "EverydayTech Agent v2"
if %errorLevel% neq 0 (
    echo ERROR: Failed to start service
    echo Check logs: C:\ProgramData\EverydayTech\logs\agent-v2.log
    pause
    exit /b 1
)

echo.
echo Verifying service status...
sc query "EverydayTech Agent v2" | find "RUNNING"
if %errorLevel% equ 0 (
    echo ✓ Service is RUNNING
) else (
    echo WARNING: Service may not be running properly
    sc query "EverydayTech Agent v2"
)

echo.
echo ========================================
echo Installation completed successfully!
echo ========================================
echo.
echo Service: EverydayTech Agent v2
echo Status: Running
echo Config: C:\ProgramData\EverydayTech\config\agent-v2.json
echo Logs: C:\ProgramData\EverydayTech\logs\agent-v2.log
echo.
echo The agent will automatically connect to https://rmm-psa-backend-t9f7k.ondigitalocean.app/api
echo Check the dashboard to see this agent appear
echo.
pause