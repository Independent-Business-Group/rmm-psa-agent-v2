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

echo Installing Windows service...
sc create "EverydayTech Agent v2" binPath= "C:\Program Files\EverydayTech\Agent\EverydayTechAgent-v2.exe" DisplayName= "EverydayTech Agent v2" start= auto

if %errorLevel% neq 0 (
    echo ERROR: Failed to create service (Error code: %errorLevel%)
    echo.
    echo Try manually: sc create "EverydayTech Agent v2" binPath= "C:\Program Files\EverydayTech\Agent\EverydayTechAgent-v2.exe" start= auto
    pause
    exit /b 1
)

echo Starting service...
net start "EverydayTech Agent v2"

if %errorLevel% neq 0 (
    echo WARNING: Service failed to start. Check the logs in C:\ProgramData\EverydayTech\logs\
) else (
    echo Service started successfully!
)

echo.
echo Service installation completed!
echo.
echo To check service status: sc query "EverydayTech Agent v2"
echo To view logs: type "C:\ProgramData\EverydayTech\logs\agent-v2.log"
echo To test RDP: "C:\Program Files\EverydayTech\Agent\helpers\rdp-helper-v2.exe" status
echo.
pause