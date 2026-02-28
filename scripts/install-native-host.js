#!/usr/bin/env node

/**
 * Installation script for the native messaging host
 * Registers the native host with Chrome/Edge and Firefox
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const NATIVE_HOST_NAME = 'com.discord.richpresence.webapp';
const platform = os.platform();
const homeDir = os.homedir();

// Get the absolute path to the native host executable
// On Windows, use .bat wrapper to prevent VS Code from opening .js files
const nativeHostFile = platform === 'win32' ? 'index.bat' : 'index.js';
const nativeHostPath = path.resolve(__dirname, '../native-host', nativeHostFile);

// Make sure the native host is executable
if (platform !== 'win32') {
  try {
    fs.chmodSync(nativeHostPath, '755');
    console.log('✓ Made native host executable');
  } catch (error) {
    console.error('Failed to make native host executable:', error.message);
  }
}

// Create the native messaging host manifest
function createManifest() {
  const manifest = {
    name: NATIVE_HOST_NAME,
    description: 'Discord Rich Presence for Web Apps',
    path: nativeHostPath,
    type: 'stdio',
    allowed_origins: [
      // Chrome extension IDs will be added here after installation
      // For development, we need to add the extension ID manually
    ]
  };

  // Firefox uses allowed_extensions instead of allowed_origins
  const firefoxManifest = {
    ...manifest,
    allowed_extensions: [
      // Firefox extension IDs will be added here
      '{discord-richpresence-webapp@extension}'
    ]
  };
  delete firefoxManifest.allowed_origins;

  return { chrome: manifest, firefox: firefoxManifest };
}

// Get the registry path for Chrome/Edge on Windows
function getWindowsRegistryPath(browser) {
  const paths = {
    chrome: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\',
    edge: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\'
  };
  return paths[browser] + NATIVE_HOST_NAME;
}

// Install for Chrome/Edge on different platforms
function installChrome() {
  const manifests = createManifest();
  
  let manifestDir;
  let manifestPath;

  if (platform === 'win32') {
    // Windows
    manifestDir = path.join(homeDir, 'AppData', 'Local', 'discord-rpc-native-host');
    manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    
    // Create directory
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    
    // Write manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifests.chrome, null, 2));
    console.log('✓ Created manifest at:', manifestPath);
    
    // Register in Windows Registry for Chrome
    try {
      const regPath = getWindowsRegistryPath('chrome');
      execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'inherit' });
      console.log('✓ Registered with Chrome');
    } catch (error) {
      console.error('Failed to register with Chrome:', error.message);
    }
    
    // Register in Windows Registry for Edge
    try {
      const regPath = getWindowsRegistryPath('edge');
      execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'inherit' });
      console.log('✓ Registered with Edge');
    } catch (error) {
      console.error('Failed to register with Edge:', error.message);
    }
    
  } else if (platform === 'darwin') {
    // macOS
    manifestDir = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
    manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    
    // Create directory
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    
    // Write manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifests.chrome, null, 2));
    console.log('✓ Registered with Chrome at:', manifestPath);
    
    // Also install for Chromium
    const chromiumDir = path.join(homeDir, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts');
    if (!fs.existsSync(chromiumDir)) {
      fs.mkdirSync(chromiumDir, { recursive: true });
    }
    fs.writeFileSync(path.join(chromiumDir, `${NATIVE_HOST_NAME}.json`), JSON.stringify(manifests.chrome, null, 2));
    console.log('✓ Registered with Chromium');
    
  } else {
    // Linux
    manifestDir = path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts');
    manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    
    // Create directory
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    
    // Write manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifests.chrome, null, 2));
    console.log('✓ Registered with Chrome at:', manifestPath);
    
    // Also install for Chromium
    const chromiumDir = path.join(homeDir, '.config', 'chromium', 'NativeMessagingHosts');
    if (!fs.existsSync(chromiumDir)) {
      fs.mkdirSync(chromiumDir, { recursive: true });
    }
    fs.writeFileSync(path.join(chromiumDir, `${NATIVE_HOST_NAME}.json`), JSON.stringify(manifests.chrome, null, 2));
    console.log('✓ Registered with Chromium');
  }
}

// Install for Firefox
function installFirefox() {
  const manifests = createManifest();
  
  let manifestDir;
  let manifestPath;

  if (platform === 'win32') {
    // Windows
    manifestDir = path.join(homeDir, 'AppData', 'Local', 'discord-rpc-native-host');
    manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}_firefox.json`);
    
    // Create directory
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    
    // Write manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifests.firefox, null, 2));
    console.log('✓ Created Firefox manifest at:', manifestPath);
    
    // Register in Windows Registry
    try {
      const regPath = `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
      execSync(`reg add "${regPath}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'inherit' });
      console.log('✓ Registered with Firefox');
    } catch (error) {
      console.error('Failed to register with Firefox:', error.message);
    }
    
  } else if (platform === 'darwin') {
    // macOS
    manifestDir = path.join(homeDir, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts');
    manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    
    // Create directory
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    
    // Write manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifests.firefox, null, 2));
    console.log('✓ Registered with Firefox at:', manifestPath);
    
  } else {
    // Linux
    manifestDir = path.join(homeDir, '.mozilla', 'native-messaging-hosts');
    manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    
    // Create directory
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    
    // Write manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifests.firefox, null, 2));
    console.log('✓ Registered with Firefox at:', manifestPath);
  }
}

// Main installation
console.log('Installing Discord Rich Presence Native Host...\n');
console.log('Platform:', platform);
console.log('Native host path:', nativeHostPath);
console.log();

try {
  installChrome();
  console.log();
  installFirefox();
  console.log();
  console.log('✓ Installation complete!');
  console.log();
  console.log('IMPORTANT: After loading the extension, you need to add its ID to the manifest.');
  console.log('Chrome extension ID can be found at chrome://extensions/');
  console.log('Then update the "allowed_origins" field in the manifest file.');
  console.log();
} catch (error) {
  console.error('Installation failed:', error);
  process.exit(1);
}
