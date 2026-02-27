@echo off
REM Windows Wrapper for Native Host
REM This prevents VS Code from opening

node "%~dp0index.js" %*
