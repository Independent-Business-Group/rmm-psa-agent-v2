@echo off
REM EverydayTech Agent v2 - Test Script

echo Testing EverydayTech Agent v2...
echo.

echo Testing Helper Applications:
echo.

echo Testing RDP Helper...
"C:\Program Files\EverydayTech\Agent\helpers\rdp-helper-v2.exe" status
echo.

echo Testing System Helper...
"C:\Program Files\EverydayTech\Agent\helpers\system-helper.exe" info
echo.

echo Testing Update Helper...
"C:\Program Files\EverydayTech\Agent\helpers\update-helper.exe" check
echo.

echo Testing Service Status...
sc query "EverydayTech Agent v2"
echo.

echo Checking Recent Logs...
if exist "C:\ProgramData\EverydayTech\logs\agent-v2.log" (
    echo Last 10 lines from agent log:
    powershell "Get-Content 'C:\ProgramData\EverydayTech\logs\agent-v2.log' -Tail 10"
) else (
    echo No log file found yet
)

echo.
echo Testing Guacamole RDP Setup...
echo This will test if the agent can enable RDP for remote access:
"C:\Program Files\EverydayTech\Agent\helpers\rdp-helper-v2.exe" enable --guacamole

echo.
echo Test completed. Check above output for any errors.
pause