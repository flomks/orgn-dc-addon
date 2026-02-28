#!/usr/bin/env node

/**
 * Check if the native messaging host is properly installed
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const NATIVE_HOST_NAME = 'com.discord.richpresence.webapp';
const platform = os.platform();
const homeDir = os.homedir();

console.log('Checking Discord Rich Presence Native Host installation...\n');
console.log('Platform:', platform);
console.log('Home directory:', homeDir);
console.log();

let allOk = true;

// Check Node.js
console.log('1. Checking Node.js...');
console.log('   Version:', process.version);
if (parseInt(process.version.slice(1).split('.')[0]) < 14) {
  console.log('   ⚠️  Node.js version should be 14 or higher');
  allOk = false;
} else {
  console.log('   ✓ Node.js version is OK');
}
console.log();

// Check native host script
console.log('2. Checking native host script...');
const nativeHostFile = platform === 'win32' ? 'index.bat' : 'index.js';
const nativeHostPath = path.resolve(__dirname, '../native-host', nativeHostFile);
if (fs.existsSync(nativeHostPath)) {
  console.log('   ✓ Native host script exists:', nativeHostPath);
  
  // Check if executable (Unix)
  if (platform !== 'win32') {
    try {
      const stats = fs.statSync(nativeHostPath);
      const isExecutable = !!(stats.mode & 0o111);
      if (isExecutable) {
        console.log('   ✓ Script is executable');
      } else {
        console.log('   ⚠️  Script is not executable. Run: chmod +x', nativeHostPath);
        allOk = false;
      }
    } catch (error) {
      console.log('   ⚠️  Could not check executable permission');
    }
  }
} else {
  console.log('   ❌ Native host script not found!');
  allOk = false;
}
console.log();

// Check Chrome manifest
console.log('3. Checking Chrome/Edge manifest...');
let chromeManifestPath;
if (platform === 'win32') {
  chromeManifestPath = path.join(homeDir, 'AppData', 'Local', 'discord-rpc-native-host', `${NATIVE_HOST_NAME}.json`);
} else if (platform === 'darwin') {
  chromeManifestPath = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
} else {
  chromeManifestPath = path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
}

if (fs.existsSync(chromeManifestPath)) {
  console.log('   ✓ Chrome manifest exists:', chromeManifestPath);
  
  try {
    const manifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf-8'));
    console.log('   ✓ Manifest is valid JSON');
    
    if (manifest.allowed_origins && manifest.allowed_origins.length > 0) {
      console.log('   ✓ Extension IDs registered:', manifest.allowed_origins.length);
      manifest.allowed_origins.forEach(origin => {
        console.log('     -', origin);
      });
    } else {
      console.log('   ⚠️  No extension IDs registered yet');
      console.log('      Run: node scripts/update-extension-id.js');
      allOk = false;
    }
  } catch (error) {
    console.log('   ❌ Manifest is invalid:', error.message);
    allOk = false;
  }
} else {
  console.log('   ❌ Chrome manifest not found!');
  console.log('      Run: npm run install-host');
  allOk = false;
}
console.log();

// Check Firefox manifest
console.log('4. Checking Firefox manifest...');
let firefoxManifestPath;
if (platform === 'win32') {
  firefoxManifestPath = path.join(homeDir, 'AppData', 'Local', 'discord-rpc-native-host', `${NATIVE_HOST_NAME}_firefox.json`);
} else if (platform === 'darwin') {
  firefoxManifestPath = path.join(homeDir, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
} else {
  firefoxManifestPath = path.join(homeDir, '.mozilla', 'native-messaging-hosts', `${NATIVE_HOST_NAME}.json`);
}

if (fs.existsSync(firefoxManifestPath)) {
  console.log('   ✓ Firefox manifest exists:', firefoxManifestPath);
} else {
  console.log('   ⚠️  Firefox manifest not found (OK if not using Firefox)');
}
console.log();

// Check Discord RPC dependency
console.log('5. Checking dependencies...');
const nodeModulesPath = path.resolve(__dirname, '../node_modules');
if (fs.existsSync(path.join(nodeModulesPath, 'discord-rpc'))) {
  console.log('   ✓ discord-rpc package installed');
} else {
  console.log('   ❌ discord-rpc package not found!');
  console.log('      Run: npm install');
  allOk = false;
}
console.log();

// Summary
console.log('='.repeat(50));
if (allOk) {
  console.log('✓ Installation looks good!');
  console.log();
  console.log('Next steps:');
  console.log('1. Load the extension in your browser');
  console.log('2. Copy the extension ID');
  console.log('3. Run: node scripts/update-extension-id.js');
  console.log('4. Open Discord Desktop App');
  console.log('5. Configure a web app and test!');
} else {
  console.log('⚠️  Some issues found. Please fix them and try again.');
  console.log();
  console.log('Common fixes:');
  console.log('- Run: npm install');
  console.log('- Run: npm run install-host');
  console.log('- Make sure Discord Desktop App is running');
}
console.log('='.repeat(50));
