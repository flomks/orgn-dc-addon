@echo off
REM Discord Rich Presence Desktop App - Quick Start
REM Startet die Electron Desktop App im Entwicklungsmodus

echo Starting Discord Rich Presence Desktop App...
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [ERROR] node_modules nicht gefunden!
    echo Bitte zuerst "npm install" ausfuehren.
    echo.
    pause
    exit /b 1
)

REM Check if electron is installed
if not exist "node_modules\.bin\electron.cmd" (
    echo [ERROR] Electron nicht installiert!
    echo Bitte zuerst "npm install" ausfuehren.
    echo.
    pause
    exit /b 1
)

REM Start Electron App
echo App wird gestartet...
call node_modules\.bin\electron.cmd desktop-app\main.js

REM If app closed with error
if errorlevel 1 (
    echo.
    echo [ERROR] App wurde mit Fehler beendet.
    pause
)
