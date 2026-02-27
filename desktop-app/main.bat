@echo off
REM Windows Wrapper for Desktop App
REM This prevents VS Code from opening

node "%~dp0main.js" %*
