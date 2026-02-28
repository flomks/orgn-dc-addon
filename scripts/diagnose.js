#!/usr/bin/env node

/**
 * Diagnostic tool for ORGN Discord Bridge
 * Tests desktop app, WebSocket server, and extension files
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const WS_PORT = 7890;
const platform = os.platform();

console.log('====================================================');
console.log('  ORGN Discord Bridge - Diagnostic Tool');
console.log('====================================================\n');

let criticalFailed = false;

function check(name, status, message, critical = false) {
  const icon = status ? '[OK]' : '[FAIL]';
  
  console.log(`${icon} ${name}`);
  if (message) {
    console.log(`     ${message}`);
  }
  
  if (!status && critical) {
    criticalFailed = true;
  }
  console.log();
}

// 1. System Info
console.log('--- System ---\n');
check('Platform', true, `${platform} (${os.arch()})`);
check('Node.js', true, `${process.version}`);

// 2. File Structure
console.log('--- Files ---\n');

const desktopAppMain = path.resolve(__dirname, '../desktop-app/main.js');
const desktopAppExists = fs.existsSync(desktopAppMain);
check('Desktop App (main.js)', desktopAppExists,
  desktopAppExists ? desktopAppMain : 'File not found!', true);

const libClient = path.resolve(__dirname, '../lib/DiscordClient.js');
const libExists = fs.existsSync(libClient);
check('DiscordClient Library', libExists,
  libExists ? libClient : 'File not found!', true);

const extensionDir = path.resolve(__dirname, '../extension');
const extFiles = ['manifest.json', 'background.js', 'popup.js', 'popup.html'];
extFiles.forEach(file => {
  const filePath = path.join(extensionDir, file);
  const exists = fs.existsSync(filePath);
  check(`Extension: ${file}`, exists,
    exists ? 'OK' : 'File not found!', true);
});

// 3. Dependencies
console.log('--- Dependencies ---\n');

const nodeModules = path.resolve(__dirname, '../node_modules');
const deps = ['discord-rpc', 'ws', 'electron'];
deps.forEach(dep => {
  const depPath = path.join(nodeModules, dep);
  const exists = fs.existsSync(depPath);
  check(`Package: ${dep}`, exists,
    exists ? 'Installed' : 'Not installed! Run: npm install', true);
});

// 4. Check if WebSocket port is available / desktop app is running
console.log('--- Desktop App Status ---\n');

function checkWebSocket() {
  return new Promise((resolve) => {
    try {
      const WebSocket = require('ws');
      const ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);
      
      const timeout = setTimeout(() => {
        ws.terminate();
        resolve(false);
      }, 3000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        ws.send(JSON.stringify({ type: 'ping' }));
        
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            console.log(`     Response: ${JSON.stringify(msg)}`);
          } catch (e) {
            // ignore
          }
          ws.close();
          resolve(true);
        });
        
        setTimeout(() => {
          ws.close();
          resolve(true);
        }, 1000);
      });
      
      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

async function runDiagnostics() {
  const wsRunning = await checkWebSocket();
  check('Desktop App Running', wsRunning,
    wsRunning
      ? `WebSocket server responding on port ${WS_PORT}`
      : `Not running. Start with: npm run app`,
    false);

  // 5. Check for Discord process
  console.log('--- Discord ---\n');
  
  try {
    let discordRunning = false;
    if (platform === 'win32') {
      const result = require('child_process').execSync('tasklist').toString();
      discordRunning = result.toLowerCase().includes('discord');
    } else {
      const result = require('child_process').execSync('ps aux').toString();
      discordRunning = result.toLowerCase().includes('discord');
    }
    check('Discord Desktop App', discordRunning,
      discordRunning ? 'Running' : 'Not running - Discord must be open for Rich Presence');
  } catch (error) {
    check('Discord Desktop App', false, 'Could not check (permission denied)');
  }

  // 6. Check for old native host files (should be removed)
  console.log('--- Cleanup Check ---\n');
  
  const oldNativeHost = path.resolve(__dirname, '../native-host');
  const nativeHostExists = fs.existsSync(oldNativeHost);
  check('Old Native Host Removed', !nativeHostExists,
    nativeHostExists
      ? 'WARNING: native-host/ directory still exists. It is no longer needed.'
      : 'Clean - native host directory removed');

  // Summary
  console.log('====================================================');
  if (criticalFailed) {
    console.log('  CRITICAL ISSUES FOUND - Fix the errors above');
  } else if (!wsRunning) {
    console.log('  Desktop app is not running.');
    console.log('  Start it with: npm run app');
  } else {
    console.log('  Everything looks good!');
  }
  console.log('====================================================');
}

runDiagnostics();
