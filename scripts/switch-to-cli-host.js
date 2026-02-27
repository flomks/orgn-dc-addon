#!/usr/bin/env node

/**
 * Switch native host to use CLI host instead of desktop app
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const NATIVE_HOST_NAME = 'com.discord.richpresence.webapp';
const platform = os.platform();
const homeDir = os.homedir();

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Switch Native Host to CLI Host (no GUI)              ║');
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
const cliHostPath = path.resolve(__dirname, '../native-host/index.js');
console.log('\nNew path:', cliHostPath);

// Check if CLI host exists
if (!fs.existsSync(cliHostPath)) {
  console.log('\n❌ CLI host not found at:', cliHostPath);
  process.exit(1);
}

console.log('✓ CLI host exists');

// Update manifest
const oldPath = manifest.path;
manifest.path = cliHostPath;

// Write manifest
try {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\n✓ Manifest updated successfully!');
  console.log('\nChanges:');
  console.log('  Old path:', oldPath);
  console.log('  New path:', manifest.path);
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n✓ SUCCESS! Native host now uses CLI Host (no GUI)');
  console.log('\nNext steps:');
  console.log('  1. Close ALL browser windows');
  console.log('  2. Restart browser');
  console.log('  3. Use extension as normal\n');
  console.log('The native host will run invisibly in background.\n');
  console.log('═'.repeat(60) + '\n');
  
} catch (error) {
  console.log('\n❌ Failed to write manifest:', error.message);
  process.exit(1);
}
