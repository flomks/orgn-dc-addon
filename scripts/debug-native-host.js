#!/usr/bin/env node

/**
 * Debug script - Shows what happens when native host starts
 */

const { spawn } = require('child_process');
const path = require('path');

const nativeHostPath = path.resolve(__dirname, '../native-host/index.js');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Native Host Debug - Real-time Error Detection        ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log('Starting native host:', nativeHostPath);
console.log('Press Ctrl+C to stop\n');
console.log('─'.repeat(60));

// Start native host with node
const nativeHost = spawn('node', [nativeHostPath]);

let hasOutput = false;
let hasError = false;

// Capture stdout (should be silent in normal operation)
nativeHost.stdout.on('data', (data) => {
  hasOutput = true;
  console.log('[STDOUT - Messaging Protocol]');
  console.log('Length:', data.length, 'bytes');
  console.log('Hex:', data.toString('hex').substring(0, 100), '...');
  console.log();
});

// Capture stderr (this is where logs go)
nativeHost.stderr.on('data', (data) => {
  hasOutput = true;
  const text = data.toString().trim();
  console.log('[STDERR - Logs]');
  console.log(text);
  console.log();
});

// Capture errors
nativeHost.on('error', (error) => {
  hasError = true;
  console.log('❌ ERROR STARTING NATIVE HOST:');
  console.log(error);
  console.log();
  
  if (error.code === 'ENOENT') {
    console.log('💡 FIX: Node.js not found in PATH');
    console.log('   Make sure Node.js is installed: node --version');
  }
  
  process.exit(1);
});

// Capture exit
nativeHost.on('close', (code, signal) => {
  console.log('─'.repeat(60));
  console.log(`\n⚠️  Native host exited!`);
  console.log('Exit code:', code);
  console.log('Signal:', signal);
  
  if (code === 0) {
    console.log('\n✓ Clean exit (this is normal if you pressed Ctrl+C)');
  } else {
    console.log('\n❌ Unexpected exit! Check errors above.');
    
    if (!hasOutput) {
      console.log('\n💡 No output received - possible issues:');
      console.log('   1. Node.js version too old (need v14+)');
      console.log('   2. Dependencies not installed (npm install)');
      console.log('   3. Syntax error in native-host/index.js');
      console.log('\nRun: npm install');
      console.log('Then try again.');
    }
  }
  
  process.exit(code || 0);
});

// Give it a moment to start
setTimeout(() => {
  if (!hasOutput && !hasError) {
    console.log('⏳ Waiting for native host to start...');
    console.log('   If nothing happens after 5 seconds, there\'s an issue.\n');
  }
}, 2000);

// Send a test ping after 3 seconds
setTimeout(() => {
  if (!hasError) {
    console.log('📤 Sending test ping...\n');
    const message = { type: 'ping' };
    const buffer = Buffer.from(JSON.stringify(message), 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);
    
    try {
      nativeHost.stdin.write(header);
      nativeHost.stdin.write(buffer);
      console.log('✓ Test message sent');
      console.log('  Waiting for response...\n');
    } catch (error) {
      console.log('❌ Failed to send test message:', error.message);
    }
  }
}, 3000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping...');
  nativeHost.kill();
  setTimeout(() => process.exit(0), 500);
});

// Prevent process from exiting
process.stdin.resume();
