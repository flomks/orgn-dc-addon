#!/usr/bin/env node

/**
 * Comprehensive diagnostic tool for Discord Rich Presence
 * Tests all components and shows detailed status
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const NATIVE_HOST_NAME = 'com.discord.richpresence.webapp';
const platform = os.platform();
const homeDir = os.homedir();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Discord Rich Presence - Diagnose Tool                    ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let allChecks = [];
let criticalFailed = false;

function check(name, status, message, critical = false) {
  const icon = status ? '✓' : '✗';
  const color = status ? '' : (critical ? '❌ CRITICAL' : '⚠️  WARNING');
  
  console.log(`${icon} ${name}`);
  if (message) {
    console.log(`  ${message}`);
  }
  if (!status && color) {
    console.log(`  ${color}`);
  }
  console.log();
  
  allChecks.push({ name, status, critical });
  if (!status && critical) {
    criticalFailed = true;
  }
}

// 1. Node.js Check
console.log('═══ System Checks ═══\n');

const nodeVersion = process.version;
const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
check(
  'Node.js Version',
  nodeMajor >= 14,
  `Version: ${nodeVersion} ${nodeMajor >= 14 ? '(OK)' : '(Upgrade needed: node.js.org)'}`,
  true
);

check('Platform', true, `${platform} (${os.arch()})`);

// 2. File Checks
console.log('═══ File Structure ═══\n');

const nativeHostPath = path.resolve(__dirname, '../native-host/index.js');
const nativeHostExists = fs.existsSync(nativeHostPath);
check(
  'Native Host Script',
  nativeHostExists,
  nativeHostExists ? nativeHostPath : 'File not found!',
  true
);

if (nativeHostExists && platform !== 'win32') {
  const stats = fs.statSync(nativeHostPath);
  const isExecutable = !!(stats.mode & 0o111);
  check(
    'Script Executable Permission',
    isExecutable,
    isExecutable ? 'OK' : `Run: chmod +x ${nativeHostPath}`
  );
}

const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJsonExists = fs.existsSync(packageJsonPath);
check('package.json', packageJsonExists, packageJsonPath, true);

// 3. Dependencies Check
console.log('═══ Dependencies ═══\n');

const nodeModulesPath = path.resolve(__dirname, '../node_modules');
const discordRpcPath = path.join(nodeModulesPath, 'discord-rpc');
const discordRpcExists = fs.existsSync(discordRpcPath);
check(
  'discord-rpc Package',
  discordRpcExists,
  discordRpcExists ? 'Installed' : 'Run: npm install',
  true
);

if (discordRpcExists) {
  try {
    const discordRpcPkg = require(path.join(discordRpcPath, 'package.json'));
    check('discord-rpc Version', true, `v${discordRpcPkg.version}`);
  } catch (e) {
    check('discord-rpc Version', false, 'Could not read version');
  }
}

// 4. Native Host Registration
console.log('═══ Native Host Registration ═══\n');

let chromeManifestPath;
if (platform === 'win32') {
  chromeManifestPath = path.join(homeDir, 'AppData', 'Local', 'discord-rpc-native-host', `${NATIVE_HOST_NAME}.json`);
} else if (platform === 'darwin') {
  chromeManifestPath = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
} else {
  chromeManifestPath = path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`);
}

const chromeManifestExists = fs.existsSync(chromeManifestPath);
check(
  'Chrome/Edge Manifest',
  chromeManifestExists,
  chromeManifestExists ? chromeManifestPath : 'Run: npm run install-host',
  true
);

if (chromeManifestExists) {
  try {
    const manifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf-8'));
    
    check('Manifest Valid JSON', true, 'Parsed successfully');
    
    const pathCorrect = manifest.path === nativeHostPath;
    check(
      'Manifest Path',
      pathCorrect,
      manifest.path + (pathCorrect ? '' : '\nExpected: ' + nativeHostPath)
    );
    
    const hasExtensions = manifest.allowed_origins && manifest.allowed_origins.length > 0;
    check(
      'Extension IDs Registered',
      hasExtensions,
      hasExtensions 
        ? `${manifest.allowed_origins.length} extension(s):\n  ${manifest.allowed_origins.join('\n  ')}`
        : 'Run: npm run update-id after loading extension',
      true
    );
  } catch (error) {
    check('Manifest Parsing', false, `Error: ${error.message}`, true);
  }
}

// 5. Extension Files
console.log('═══ Browser Extension ═══\n');

const extensionDir = path.resolve(__dirname, '../extension');
const extensionExists = fs.existsSync(extensionDir);
check('Extension Directory', extensionExists, extensionDir, true);

if (extensionExists) {
  const manifestPath = path.join(extensionDir, 'manifest.json');
  const manifestExists = fs.existsSync(manifestPath);
  check('Extension manifest.json', manifestExists, manifestPath, true);
  
  const backgroundPath = path.join(extensionDir, 'background.js');
  check('background.js', fs.existsSync(backgroundPath), backgroundPath, true);
  
  const popupPath = path.join(extensionDir, 'popup.html');
  check('popup.html', fs.existsSync(popupPath), popupPath);
}

// 6. Discord Check
console.log('═══ Discord Environment ═══\n');

// Try to detect if Discord is running
let discordRunning = false;
if (platform === 'win32') {
  try {
    const result = require('child_process').execSync('tasklist').toString();
    discordRunning = result.toLowerCase().includes('discord.exe');
  } catch (e) {
    // Can't determine
  }
} else {
  try {
    const result = require('child_process').execSync('ps aux').toString();
    discordRunning = result.toLowerCase().includes('discord');
  } catch (e) {
    // Can't determine
  }
}

check(
  'Discord Process Detected',
  discordRunning,
  discordRunning 
    ? 'Discord appears to be running' 
    : 'Could not detect Discord (may be false negative)\n  Make sure Discord Desktop App is running!'
);

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('SUMMARY\n');

const passed = allChecks.filter(c => c.status).length;
const failed = allChecks.filter(c => !c.status).length;
const criticalFailures = allChecks.filter(c => !c.status && c.critical).length;

console.log(`Total Checks: ${allChecks.length}`);
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
if (criticalFailures > 0) {
  console.log(`❌ Critical Failures: ${criticalFailures}\n`);
}

console.log('═══════════════════════════════════════════════════════════\n');

if (criticalFailed) {
  console.log('❌ CRITICAL ISSUES FOUND!\n');
  console.log('Please fix critical issues before continuing:\n');
  
  allChecks.filter(c => !c.status && c.critical).forEach(c => {
    console.log(`  ✗ ${c.name}`);
  });
  
  console.log('\nCommon fixes:');
  console.log('  npm install          - Install dependencies');
  console.log('  npm run install-host - Register native host');
  console.log('  npm run update-id    - Register extension ID\n');
  
  process.exit(1);
} else if (failed > 0) {
  console.log('⚠️  Some non-critical issues found.\n');
  console.log('The system may still work, but check warnings above.\n');
} else {
  console.log('✓ ALL CHECKS PASSED!\n');
  console.log('Next steps:');
  console.log('  1. Load extension in browser');
  console.log('  2. Register extension ID: npm run update-id');
  console.log('  3. Create Discord Application');
  console.log('  4. Configure a web app');
  console.log('  5. Test it!\n');
  console.log('For testing: npm run test\n');
}

console.log('═══════════════════════════════════════════════════════════');
