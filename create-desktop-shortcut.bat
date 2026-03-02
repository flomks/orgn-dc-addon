@echo off
REM ORGN Discord Bridge - Desktop Shortcut Creator
REM Creates a desktop shortcut for the Electron App

echo ====================================================
echo ORGN Discord Bridge - Create Desktop Shortcut
echo ====================================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell not found!
    echo Please create a shortcut to start-app.bat manually.
    pause
    exit /b 1
)

REM Run PowerShell script
echo Creating desktop shortcut...
powershell -ExecutionPolicy Bypass -File "%~dp0create-desktop-shortcut.ps1"

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to create the shortcut.
    pause
    exit /b 1
)
