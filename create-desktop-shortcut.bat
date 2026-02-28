@echo off
REM Discord Rich Presence - Desktop Shortcut Creator
REM Erstellt eine Desktop-Verknuepfung fuer die Electron App

echo ========================================================
echo Discord Rich Presence - Desktop Verknuepfung erstellen
echo ========================================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell nicht gefunden!
    echo Bitte manuell eine Verknuepfung zu start-app.bat erstellen.
    pause
    exit /b 1
)

REM Run PowerShell script
echo Erstelle Desktop-Verknuepfung...
powershell -ExecutionPolicy Bypass -File "%~dp0create-desktop-shortcut.ps1"

if errorlevel 1 (
    echo.
    echo [ERROR] Fehler beim Erstellen der Verknuepfung.
    pause
    exit /b 1
)
