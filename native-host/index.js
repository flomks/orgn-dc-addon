#!/usr/bin/env node

/**
 * Native Messaging Host for Discord Rich Presence
 * 
 * This native host receives messages from the browser extension
 * and communicates with Discord via the Discord RPC protocol.
 */

const DiscordClient = require('../lib/DiscordClient');

// Native messaging uses stdin/stdout for communication
// We need to read/write messages in a specific format

let discordClient = null;

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

  process.stdin.on('end', async () => {
    log('stdin ended');
    await cleanup();
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

// Initialize Discord client with event handlers
function initializeDiscordClient() {
  if (discordClient) {
    return discordClient;
  }

  discordClient = new DiscordClient({
    onReady: (user) => {
      sendMessage({ type: 'connected', user });
    },
    onDisconnected: () => {
      // Discord client handles reconnection internally
    },
    onError: (error) => {
      sendMessage({ type: 'error', error: error.message });
    },
    onActivitySet: () => {
      sendMessage({ type: 'activitySet', success: true });
    },
    onActivityCleared: () => {
      sendMessage({ type: 'activityCleared', success: true });
    },
    onLog: (level, ...args) => {
      log(...args);
    }
  });

  return discordClient;
}

// Set Discord activity
async function setActivity(activityData) {
  const client = initializeDiscordClient();
  const result = await client.setActivity(activityData);
  
  if (!result.success) {
    sendMessage({ type: 'error', error: result.error });
  }
}

// Clear Discord activity
async function clearActivity() {
  const client = initializeDiscordClient();
  const result = await client.clearActivity();
  
  if (!result.success) {
    sendMessage({ type: 'error', error: result.error });
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
async function cleanup() {
  log('Cleaning up...');
  
  if (discordClient) {
    try {
      await discordClient.destroy();
    } catch (error) {
      log('Error destroying Discord client:', error);
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
  process.on('SIGINT', async () => {
    log('Received SIGINT');
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    log('Received SIGTERM');
    await cleanup();
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
    await cleanup();
    process.exit(1);
  }
}

// Start the native host
main().catch(async (error) => {
  log('Fatal error:', error);
  await cleanup();
  process.exit(1);
});
