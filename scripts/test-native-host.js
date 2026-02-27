#!/usr/bin/env node

/**
 * Test script for the native messaging host
 * Simulates messages from the browser extension
 */

const { spawn } = require('child_process');
const path = require('path');

const nativeHostPath = path.resolve(__dirname, '../native-host/index.js');

console.log('Testing native messaging host...\n');
console.log('Native host path:', nativeHostPath);
console.log();

// Create test activity
const testActivity = {
  clientId: '1234567890123456789', // Replace with your test application ID
  activity: {
    details: 'Testing Rich Presence',
    state: 'Development Mode',
    startTimestamp: Date.now(),
    largeImageKey: 'default',
    largeImageText: 'Test Application',
    instance: false
  }
};

// Start native host
const nativeHost = spawn('node', [nativeHostPath]);

// Handle stdout (messages from native host)
nativeHost.stdout.on('data', (data) => {
  try {
    // Native messaging format: 4 bytes length + JSON message
    let offset = 0;
    while (offset < data.length) {
      if (data.length - offset < 4) break;
      
      const messageLength = data.readUInt32LE(offset);
      offset += 4;
      
      if (data.length - offset < messageLength) break;
      
      const messageBuffer = data.slice(offset, offset + messageLength);
      const message = JSON.parse(messageBuffer.toString('utf-8'));
      
      console.log('✓ Received from native host:');
      console.log(JSON.stringify(message, null, 2));
      console.log();
      
      offset += messageLength;
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

// Handle stderr (logs from native host)
nativeHost.stderr.on('data', (data) => {
  console.log('[Native Host Log]', data.toString().trim());
});

// Handle errors
nativeHost.on('error', (error) => {
  console.error('Failed to start native host:', error);
  process.exit(1);
});

// Handle exit
nativeHost.on('close', (code) => {
  console.log(`Native host exited with code ${code}`);
  process.exit(code);
});

// Send test messages
function sendMessage(message) {
  const buffer = Buffer.from(JSON.stringify(message), 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);
  
  nativeHost.stdin.write(header);
  nativeHost.stdin.write(buffer);
  
  console.log('→ Sent to native host:');
  console.log(JSON.stringify(message, null, 2));
  console.log();
}

// Wait a bit for initialization
setTimeout(() => {
  console.log('\n=== Starting tests ===\n');
  
  // Test 1: Ping
  console.log('Test 1: Ping');
  sendMessage({ type: 'ping' });
  
  setTimeout(() => {
    // Test 2: Set activity
    console.log('Test 2: Set Activity');
    sendMessage({ type: 'setActivity', activity: testActivity });
    
    setTimeout(() => {
      // Test 3: Clear activity
      console.log('Test 3: Clear Activity');
      sendMessage({ type: 'clearActivity' });
      
      setTimeout(() => {
        console.log('\n=== Tests complete ===');
        console.log('Check your Discord profile to see if the activity appeared!');
        console.log('\nPress Ctrl+C to exit...');
      }, 2000);
    }, 5000);
  }, 2000);
}, 1000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  nativeHost.kill();
  process.exit(0);
});
