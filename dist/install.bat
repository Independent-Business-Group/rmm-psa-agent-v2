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

echo Creating directories...
mkdir "C:\Program Files\EverydayTech\Agent" 2>nul
mkdir "C:\Program Files\EverydayTech\Agent\helpers" 2>nul
mkdir "C:\ProgramData\EverydayTech\logs" 2>nul
mkdir "C:\ProgramData\EverydayTech\config" 2>nul

echo Copying agent files...
copy /Y EverydayTechAgent-v2-win.exe "C:\Program Files\EverydayTech\Agent\EverydayTechAgent-v2.exe"
if %errorLevel% neq 0 (
    echo ERROR: Failed to copy agent executable
    pause
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
    echo {> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo   "version": "2.0.0",>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo   "backendUrl": "https://everydaytech.au/api",>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo   "websocketUrl": "wss://everydaytech.au/api/agent/ws",>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo   "logLevel": "info",>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo   "helpers": {>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo     "timeout": 30000,>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo     "retryAttempts": 2,>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo     "enabled": ["rdp-helper-v2", "system-helper", "update-helper"]>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo   },>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo   "features": {>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo     "remoteDesktop": true,>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo     "systemInfo": true>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo   }>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
    echo }>> "C:\ProgramData\EverydayTech\config\agent-v2.json"
)

echo Testing helper applications...
"C:\Program Files\EverydayTech\Agent\helpers\rdp-helper-v2.exe" --version
if %errorLevel% neq 0 (
    echo WARNING: RDP Helper may not work properly
)

"C:\Program Files\EverydayTech\Agent\helpers\system-helper.exe" --version  
if %errorLevel% neq 0 (
    echo WARNING: System Helper may not work properly
)

echo.
echo Installation completed successfully!
echo.
echo Next steps:
echo 1. Configure the backend URL in C:\ProgramData\EverydayTech\config\agent-v2.json
echo 2. Run install-service.bat to install the Windows service
echo 3. Test remote desktop functionality
echo.
pause