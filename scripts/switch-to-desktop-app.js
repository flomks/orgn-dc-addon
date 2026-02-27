#!/usr/bin/env node

/**
 * Switch native host to use desktop app instead of CLI host
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const NATIVE_HOST_NAME = 'com.discord.richpresence.webapp';
const platform = os.platform();
const homeDir = os.homedir();

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Switch Native Host to Desktop App                    ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Get manifest path
let manifestPath;
if (platform === 'win32') {
  manifestPath = path.join(homeDir, 'AppData', 'Local', 'discord-rpc-native-host', `${NATIVE_HOST_NAME}.json`);
} else if (platform === 'darwin') {
  manifestPath = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
} else {
  manifestPath = path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
}

console.log('Manifest path:', manifestPath);

if (!fs.existsSync(manifestPath)) {
  console.log('\n❌ Manifest file not found!');
  console.log('   Please run: npm run install-host first\n');
  process.exit(1);
}

// Read manifest
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('\n✓ Manifest loaded');
} catch (error) {
  console.log('\n❌ Failed to read manifest:', error.message);
  process.exit(1);
}

// Get new path
const desktopAppPath = path.resolve(__dirname, '../desktop-app/main.js');
console.log('\nNew path:', desktopAppPath);

// Check if desktop app exists
if (!fs.existsSync(desktopAppPath)) {
  console.log('\n❌ Desktop app not found at:', desktopAppPath);
  process.exit(1);
}

console.log('✓ Desktop app exists');

// Update manifest
const oldPath = manifest.path;
manifest.path = desktopAppPath;

// Write manifest
try {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\n✓ Manifest updated successfully!');
  console.log('\nChanges:');
  console.log('  Old path:', oldPath);
  console.log('  New path:', manifest.path);
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n✓ SUCCESS! Native host now uses Desktop App');
  console.log('\nNext steps:');
  console.log('  1. Close ALL browser windows');
  console.log('  2. Start desktop app: npm run app');
  console.log('  3. Restart browser');
  console.log('  4. Use extension as normal\n');
  console.log('The desktop app will show all logs! 🎉\n');
  console.log('═'.repeat(60) + '\n');
  
} catch (error) {
  console.log('\n❌ Failed to write manifest:', error.message);
  process.exit(1);
}
