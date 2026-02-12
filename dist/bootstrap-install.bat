@echo off
REM EverydayTech Agent v2 - Bootstrap Installer
REM Downloads latest release from GitHub and installs

echo ========================================
echo EverydayTech Agent v2 - Bootstrap Installer
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [1/5] Creating temporary download directory...
set TEMP_DIR=%TEMP%\everydaytech-agent-install
if exist "%TEMP_DIR%" rmdir /S /Q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"
cd /d "%TEMP_DIR%"

echo.
echo [2/5] Downloading latest Agent v2 from GitHub...
echo URL: https://github.com/Independent-Business-Group/rmm-psa-agent-v2/releases/latest/download/agent-v2-windows-deployment.zip
echo.

powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/Independent-Business-Group/rmm-psa-agent-v2/releases/latest/download/agent-v2-windows-deployment.zip' -OutFile 'agent-v2.zip' -UseBasicParsing}"

if %errorLevel% neq 0 (
    echo ERROR: Failed to download agent
    echo Please check your internet connection
    pause
    exit /b 1
)

echo.
echo [3/5] Extracting files...
powershell -Command "& {Expand-Archive -Path 'agent-v2.zip' -DestinationPath '.' -Force}"

if %errorLevel% neq 0 (
    echo ERROR: Failed to extract files
    pause
    exit /b 1
)

REM Check if we have the extracted structure
if exist "agent-v2-deploy\install.bat" (
    cd agent-v2-deploy
) else if exist "install.bat" (
    REM Files extracted to current dir
    echo Files extracted successfully
) else (
    echo ERROR: install.bat not found in extracted files
    dir
    pause
    exit /b 1
)

echo.
echo [4/5] Running installer...
echo.
call install.bat

if %errorLevel% neq 0 (
    echo.
    echo ERROR: Installation failed
    pause
    exit /b 1
)

echo.
echo [5/5] Running service installer...
echo.
call install-service.bat

if %errorLevel% neq 0 (
    echo.
    echo WARNING: Service installation failed
    echo You can try running install-service.bat manually later
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Cleaning up temporary files...
cd /d "%TEMP%"
rmdir /S /Q "%TEMP_DIR%" 2>nul

echo.
echo Agent installed successfully!
echo Service: EverydayTech Agent v2
echo Config: C:\ProgramData\EverydayTech\config\agent-v2.json
echo Logs: C:\ProgramData\EverydayTech\logs\agent-v2.log
echo.
echo To check service status: sc query "EverydayTech Agent v2"
echo.
pause
