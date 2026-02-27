#!/usr/bin/env node

/**
 * Fix Windows manifest to use .bat wrapper instead of .js directly
 * This prevents VS Code from opening
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

if (os.platform() !== 'win32') {
  console.log('This script is only for Windows!');
  console.log('On Mac/Linux, .js files work fine.\n');
  process.exit(0);
}

const NATIVE_HOST_NAME = 'com.discord.richpresence.webapp';
const homeDir = os.homedir();

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Fix Windows VS Code Opening Issue                    ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

const manifestPath = path.join(homeDir, 'AppData', 'Local', 'discord-rpc-native-host', `${NATIVE_HOST_NAME}.json`);

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

// Get current path
const currentPath = manifest.path;
console.log('\nCurrent path:', currentPath);

// Determine new path
let newPath;
if (currentPath.includes('desktop-app')) {
  // Using desktop app
  newPath = path.resolve(__dirname, '../desktop-app/main.bat');
  console.log('Mode: Desktop App (GUI)');
} else {
  // Using native host
  newPath = path.resolve(__dirname, '../native-host/index.bat');
  console.log('Mode: Native Host (CLI)');
}

console.log('New path:', newPath);

// Check if .bat file exists
if (!fs.existsSync(newPath)) {
  console.log('\n❌ Wrapper script not found:', newPath);
  console.log('   This should have been created automatically.');
  process.exit(1);
}

console.log('✓ Wrapper script exists');

// Update manifest
manifest.path = newPath;

// Write manifest
try {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\n✓ Manifest updated successfully!');
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ FIXED! VS Code will no longer open!');
  console.log('\nWhat changed:');
  console.log('  Before:', currentPath);
  console.log('  After:', newPath);
  console.log('\nThe .bat wrapper calls node.exe directly.');
  console.log('Windows will NOT open VS Code anymore!');
  
  console.log('\nNext steps:');
  console.log('  1. Close ALL browser windows');
  console.log('  2. Restart browser');
  console.log('  3. Test the extension\n');
  console.log('✅ No more VS Code opening! 🎉\n');
  console.log('═'.repeat(60) + '\n');
  
} catch (error) {
  console.log('\n❌ Failed to write manifest:', error.message);
  process.exit(1);
}
