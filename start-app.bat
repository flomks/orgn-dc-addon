@echo off
REM ORGN Discord Bridge - Quick Start
REM Starts the Electron Desktop App in development mode

echo Starting ORGN Discord Bridge...
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [ERROR] node_modules not found!
    echo Please run "npm install" first.
    echo.
    pause
    exit /b 1
)

REM Check if electron is installed
if not exist "node_modules\.bin\electron.cmd" (
    echo [ERROR] Electron not installed!
    echo Please run "npm install" first.
    echo.
    pause
    exit /b 1
)

REM Start Electron App
echo Starting app...
call node_modules\.bin\electron.cmd desktop-app\main.js

REM If app closed with error
if errorlevel 1 (
    echo.
    echo [ERROR] App exited with an error.
    pause
)
