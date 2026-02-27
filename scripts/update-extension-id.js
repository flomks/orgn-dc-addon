#!/usr/bin/env node

/**
 * Helper script to update the native host manifest with the extension ID
 * Run this after you've loaded the extension and know its ID
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const NATIVE_HOST_NAME = 'com.discord.richpresence.webapp';
const platform = os.platform();
const homeDir = os.homedir();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('Update Extension ID in Native Host Manifest\n');
  console.log('First, load the extension in your browser and copy its ID:');
  console.log('Chrome: chrome://extensions/ (enable Developer Mode)');
  console.log('Firefox: about:debugging#/runtime/this-firefox\n');
  
  const extensionId = await question('Enter the extension ID: ');
  
  if (!extensionId.trim()) {
    console.log('No extension ID provided. Exiting.');
    rl.close();
    return;
  }
  
  console.log();
  
  // Update Chrome manifest
  let chromeManifestPath;
  if (platform === 'win32') {
    chromeManifestPath = path.join(homeDir, 'AppData', 'Local', 'discord-rpc-native-host', `${NATIVE_HOST_NAME}.json`);
  } else if (platform === 'darwin') {
    chromeManifestPath = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
  } else {
    chromeManifestPath = path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
  }
  
  if (fs.existsSync(chromeManifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf-8'));
      const origin = `chrome-extension://${extensionId.trim()}/`;
      
      if (!manifest.allowed_origins) {
        manifest.allowed_origins = [];
      }
      
      if (!manifest.allowed_origins.includes(origin)) {
        manifest.allowed_origins.push(origin);
        fs.writeFileSync(chromeManifestPath, JSON.stringify(manifest, null, 2));
        console.log('✓ Updated Chrome manifest at:', chromeManifestPath);
      } else {
        console.log('✓ Extension ID already in Chrome manifest');
      }
    } catch (error) {
      console.error('Failed to update Chrome manifest:', error.message);
    }
  } else {
    console.log('Chrome manifest not found. Did you run "npm run install-host"?');
  }
  
  console.log();
  console.log('Done! Restart your browser or reload the extension for changes to take effect.');
  rl.close();
}

main().catch(console.error);
