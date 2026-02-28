#!/bin/bash
# ORGN Discord Bridge - Quick Start
# Startet die Electron Desktop App im Entwicklungsmodus

echo "Starting ORGN Discord Bridge..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[ERROR] node_modules not found!"
    echo "Please run 'npm install' first."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if electron is installed
if [ ! -f "node_modules/.bin/electron" ]; then
    echo "[ERROR] Electron not installed!"
    echo "Please run 'npm install' first."
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Start Electron App
echo "Starting app..."
npm run app

# If app closed with error
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] App exited with error."
    read -p "Press Enter to exit..."
fi
