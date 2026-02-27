#!/usr/bin/env node

/**
 * Uninstallation script for the native messaging host
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const NATIVE_HOST_NAME = 'com.discord.richpresence.webapp';
const platform = os.platform();
const homeDir = os.homedir();

function uninstallChrome() {
  if (platform === 'win32') {
    // Windows - remove from registry
    try {
      const regPath = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
      execSync(`reg delete "${regPath}" /f`, { stdio: 'inherit' });
      console.log('✓ Removed Chrome registry entry');
    } catch (error) {
      console.log('Chrome registry entry not found or already removed');
    }
    
    try {
      const regPath = `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
      execSync(`reg delete "${regPath}" /f`, { stdio: 'inherit' });
      console.log('✓ Removed Edge registry entry');
    } catch (error) {
      console.log('Edge registry entry not found or already removed');
    }
    
  } else if (platform === 'darwin') {
    // macOS
    const manifestPath = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
      console.log('✓ Removed Chrome manifest');
    }
    
    const chromiumPath = path.join(homeDir, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
    if (fs.existsSync(chromiumPath)) {
      fs.unlinkSync(chromiumPath);
      console.log('✓ Removed Chromium manifest');
    }
    
  } else {
    // Linux
    const manifestPath = path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
      console.log('✓ Removed Chrome manifest');
    }
    
    const chromiumPath = path.join(homeDir, '.config', 'chromium', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
    if (fs.existsSync(chromiumPath)) {
      fs.unlinkSync(chromiumPath);
      console.log('✓ Removed Chromium manifest');
    }
  }
}

function uninstallFirefox() {
  if (platform === 'win32') {
    // Windows - remove from registry
    try {
      const regPath = `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
      execSync(`reg delete "${regPath}" /f`, { stdio: 'inherit' });
      console.log('✓ Removed Firefox registry entry');
    } catch (error) {
      console.log('Firefox registry entry not found or already removed');
    }
    
  } else if (platform === 'darwin') {
    // macOS
    const manifestPath = path.join(homeDir, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
      console.log('✓ Removed Firefox manifest');
    }
    
  } else {
    // Linux
    const manifestPath = path.join(homeDir, '.mozilla', 'native-messaging-hosts', `${NATIVE_HOST_NAME}.json`);
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
      console.log('✓ Removed Firefox manifest');
    }
  }
}

console.log('Uninstalling Discord Rich Presence Native Host...\n');

try {
  uninstallChrome();
  uninstallFirefox();
  console.log();
  console.log('✓ Uninstallation complete!');
} catch (error) {
  console.error('Uninstallation failed:', error);
  process.exit(1);
}
