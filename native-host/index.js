#!/usr/bin/env node

/**
 * Native Messaging Host for Discord Rich Presence
 * 
 * This native host receives messages from the browser extension
 * and communicates with Discord via the Discord RPC protocol.
 */

const DiscordRPC = require('discord-rpc');

// Native messaging uses stdin/stdout for communication
// We need to read/write messages in a specific format

let currentClient = null;
let currentActivity = null;
let reconnectTimer = null;

// Log to stderr (stdout is used for communication with browser)
function log(...args) {
  console.error('[Native Host]', ...args);
}

// Read message from browser extension
function readMessage() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;
    let messageLength = null;

    process.stdin.on('readable', function onReadable() {
      let chunk;

      // Read the message length (first 4 bytes)
      if (messageLength === null) {
        chunk = process.stdin.read(4);
        if (chunk === null) return;
        
        messageLength = chunk.readUInt32LE(0);
        log('Message length:', messageLength);
      }

      // Read the message content
      while ((chunk = process.stdin.read(messageLength - totalLength)) !== null) {
        chunks.push(chunk);
        totalLength += chunk.length;

        if (totalLength === messageLength) {
          const messageBuffer = Buffer.concat(chunks);
          const messageText = messageBuffer.toString('utf-8');
          
          try {
            const message = JSON.parse(messageText);
            resolve(message);
          } catch (error) {
            reject(new Error('Failed to parse message: ' + error.message));
          }

          // Reset for next message
          chunks.length = 0;
          totalLength = 0;
          messageLength = null;
        }
      }
    });

    process.stdin.on('end', () => {
      log('stdin ended');
      cleanup();
      process.exit(0);
    });

    process.stdin.on('error', (error) => {
      log('stdin error:', error);
      reject(error);
    });
  });
}

// Send message to browser extension
function sendMessage(message) {
  try {
    const buffer = Buffer.from(JSON.stringify(message), 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);
    
    process.stdout.write(header);
    process.stdout.write(buffer);
    
    log('Sent message:', message.type);
  } catch (error) {
    log('Error sending message:', error);
  }
}

// Connect to Discord
async function connectDiscord(clientId) {
  if (currentClient && currentClient.user) {
    log('Already connected to Discord');
    return currentClient;
  }

  try {
    log('Connecting to Discord with client ID:', clientId);
    
    // Close existing client if any
    if (currentClient) {
      try {
        await currentClient.destroy();
      } catch (e) {
        // Ignore
      }
    }

    const client = new DiscordRPC.Client({ transport: 'ipc' });
    
    client.on('ready', () => {
      log('Discord RPC connected as:', client.user.username);
      sendMessage({ type: 'connected', user: client.user });
    });

    client.on('disconnected', () => {
      log('Discord RPC disconnected');
      currentClient = null;
      
      // Try to reconnect after 5 seconds
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = setTimeout(() => {
        if (currentActivity) {
          connectDiscord(currentActivity.clientId);
        }
      }, 5000);
    });

    await client.login({ clientId });
    currentClient = client;
    
    return client;
  } catch (error) {
    log('Failed to connect to Discord:', error.message);
    currentClient = null;
    throw error;
  }
}

// Set Discord activity
async function setActivity(activityData) {
  try {
    const { clientId, activity } = activityData;
    
    if (!clientId) {
      throw new Error('Client ID is required');
    }

    log('Setting activity:', activity);
    currentActivity = activityData;

    // Connect to Discord if not connected
    const client = await connectDiscord(clientId);

    // Set the activity
    await client.setActivity(activity);
    
    log('Activity set successfully');
    sendMessage({ type: 'activitySet', success: true });
  } catch (error) {
    log('Error setting activity:', error.message);
    sendMessage({ type: 'error', error: error.message });
  }
}

// Clear Discord activity
async function clearActivity() {
  try {
    log('Clearing activity');
    currentActivity = null;

    if (currentClient && currentClient.user) {
      await currentClient.clearActivity();
      log('Activity cleared successfully');
    }
    
    sendMessage({ type: 'activityCleared', success: true });
  } catch (error) {
    log('Error clearing activity:', error.message);
    sendMessage({ type: 'error', error: error.message });
  }
}

// Handle incoming message
async function handleMessage(message) {
  log('Received message:', message.type);

  try {
    switch (message.type) {
      case 'ping':
        sendMessage({ type: 'pong' });
        break;

      case 'setActivity':
        await setActivity(message.activity);
        break;

      case 'clearActivity':
        await clearActivity();
        break;

      default:
        log('Unknown message type:', message.type);
        sendMessage({ type: 'error', error: 'Unknown message type' });
    }
  } catch (error) {
    log('Error handling message:', error);
    sendMessage({ type: 'error', error: error.message });
  }
}

// Cleanup on exit
function cleanup() {
  log('Cleaning up...');
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  if (currentClient) {
    try {
      currentClient.destroy();
    } catch (error) {
      log('Error destroying client:', error);
    }
  }
}

// Main loop
async function main() {
  log('Native host started');
  log('Node version:', process.version);
  log('Platform:', process.platform);
  
  // Send initial connected message
  sendMessage({ type: 'connected' });

  // Handle process signals
  process.on('SIGINT', () => {
    log('Received SIGINT');
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Received SIGTERM');
    cleanup();
    process.exit(0);
  });

  // Main message loop
  try {
    while (true) {
      const message = await readMessage();
      await handleMessage(message);
    }
  } catch (error) {
    log('Error in main loop:', error);
    cleanup();
    process.exit(1);
  }
}

// Start the native host
main().catch((error) => {
  log('Fatal error:', error);
  cleanup();
  process.exit(1);
});
