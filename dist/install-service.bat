@echo off
REM EverydayTech Agent v2 - Service Installation Script
REM Run as Administrator

echo Installing EverydayTech Agent v2 as Windows Service...
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    pause
    exit /b 1
)

echo Installing Windows service using node-windows wrapper...
echo.

REM Use the agent executable to run itself as a service wrapper
"C:\Program Files\EverydayTech\Agent\EverydayTechAgent-v2.exe" --service-install

if %errorLevel% neq 0 (
    echo ERROR: Failed to install service (Error code: %errorLevel%)
    echo.
    echo The agent must include node-windows service wrapper support.
    pause
    exit /b 1
)

echo.
echo Service installation completed!
echo.
echo To check service status: sc query "EverydayTech Agent v2"
echo To view logs: type "C:\ProgramData\EverydayTech\logs\agent-v2.log"
echo To test RDP: "C:\Program Files\EverydayTech\Agent\helpers\rdp-helper-v2.exe" status
echo.
pause