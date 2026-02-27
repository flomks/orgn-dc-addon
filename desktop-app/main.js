const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const DiscordClient = require('../lib/DiscordClient');

let mainWindow = null;
let tray = null;
let discordClient = null;
let logs = [];
const MAX_LOGS = 1000;
let extensionConnected = false;
let lastExtensionPing = null;

// Log function
function addLog(level, ...args) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const message = args.join(' ');
  const logEntry = { timestamp, level, message };
  
  logs.push(logEntry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
  
  // Send to renderer if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log', logEntry);
  }
  
  console.log(`[${level}]`, ...args);
}

// Initialize Discord client with event handlers
function initializeDiscordClient() {
  if (discordClient) {
    return discordClient;
  }

  discordClient = new DiscordClient({
    onReady: (user) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('discord-connected', user);
      }
    },
    onDisconnected: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('discord-disconnected');
      }
    },
    onError: (error) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('discord-error', error.message);
      }
    },
    onActivitySet: (activity) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('activity-set', activity);
      }
    },
    onActivityCleared: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('activity-cleared');
      }
    },
    onLog: (level, ...args) => {
      addLog(level.toUpperCase(), ...args);
    }
  });

  return discordClient;
}

// Set Discord activity
async function setActivity(activityData) {
  const client = initializeDiscordClient();
  return await client.setActivity(activityData);
}

// Clear Discord activity
async function clearActivity() {
  const client = initializeDiscordClient();
  return await client.clearActivity();
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../extension/icons/icon128.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    backgroundColor: '#2c2f33',
    skipTaskbar: false  // Show in taskbar when window is visible
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      mainWindow.setSkipTaskbar(true);  // Hide from taskbar when minimized
    }
  });

  mainWindow.on('show', () => {
    mainWindow.setSkipTaskbar(false);  // Show in taskbar when visible
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Send initial data
  mainWindow.webContents.on('did-finish-load', () => {
    // Send all logs
    logs.forEach(log => {
      mainWindow.webContents.send('log', log);
    });
    
    // Initialize Discord client if needed and send status
    const client = initializeDiscordClient();
    const status = client.getStatus();
    
    // Send connection status
    if (status.connected) {
      mainWindow.webContents.send('discord-connected', status.user);
    }
    
    // Send current activity
    if (status.activity) {
      mainWindow.webContents.send('activity-set', status.activity.activity);
    }
  });
}

// Create tray icon
function createTray() {
  const iconPath = path.join(__dirname, '../extension/icons/icon16.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon);
  
  const updateTrayMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Discord Rich Presence',
        enabled: false
      },
      { type: 'separator' },
      {
        label: mainWindow && mainWindow.isVisible() ? 'Hide Window' : 'Show Window',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isVisible()) {
              mainWindow.hide();
              mainWindow.setSkipTaskbar(true);
            } else {
              mainWindow.show();
              mainWindow.setSkipTaskbar(false);
            }
          } else {
            createWindow();
          }
          updateTrayMenu();
        }
      },
      {
        label: 'Clear Activity',
        click: () => {
          clearActivity();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
  };
  
  updateTrayMenu();
  
  tray.setToolTip('Discord Rich Presence');
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
        mainWindow.setSkipTaskbar(true);
      } else {
        mainWindow.show();
        mainWindow.setSkipTaskbar(false);
      }
    } else {
      createWindow();
    }
    updateTrayMenu();
  });
}

// IPC Handlers
ipcMain.handle('get-logs', () => {
  return logs;
});

ipcMain.handle('clear-logs', () => {
  logs = [];
  return { success: true };
});

ipcMain.handle('set-activity', async (event, activityData) => {
  return await setActivity(activityData);
});

ipcMain.handle('clear-activity', async () => {
  return await clearActivity();
});

ipcMain.handle('get-status', () => {
  const client = initializeDiscordClient();
  const status = client.getStatus();
  
  return {
    connected: status.connected,
    user: status.user,
    activity: status.activity,
    extensionConnected: extensionConnected,
    lastExtensionPing: lastExtensionPing
  };
});

ipcMain.handle('get-extension-status', () => {
  const now = Date.now();
  const timeSinceLastPing = lastExtensionPing ? now - lastExtensionPing : null;
  
  return {
    connected: extensionConnected,
    lastPing: lastExtensionPing,
    timeSinceLastPing: timeSinceLastPing,
    isNativeMessagingMode: process.stdin.isTTY === false
  };
});

ipcMain.handle('test-connection', async (event, clientId) => {
  const client = initializeDiscordClient();
  return await client.testConnection(clientId);
});

// Native Messaging Handler (for browser extension)
if (process.stdin.isTTY === false) {
  // We're being called by browser extension
  addLog('INFO', 'Running in native messaging mode');
  
  let messageBuffer = Buffer.alloc(0);
  
  process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
      messageBuffer = Buffer.concat([messageBuffer, chunk]);
      
      // Try to parse messages
      while (messageBuffer.length >= 4) {
        const messageLength = messageBuffer.readUInt32LE(0);
        
        if (messageBuffer.length >= 4 + messageLength) {
          const messageData = messageBuffer.slice(4, 4 + messageLength);
          messageBuffer = messageBuffer.slice(4 + messageLength);
          
          try {
            const message = JSON.parse(messageData.toString('utf-8'));
            handleNativeMessage(message);
          } catch (error) {
            addLog('ERROR', 'Failed to parse message:', error.message);
          }
        } else {
          break;
        }
      }
    }
  });
  
  process.stdin.on('end', () => {
    addLog('INFO', 'Browser extension disconnected');
    app.quit();
  });
}

function handleNativeMessage(message) {
  addLog('INFO', 'Received from extension:', message.type);
  
  // Mark extension as connected
  extensionConnected = true;
  lastExtensionPing = Date.now();
  
  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('extension-message', {
      type: message.type,
      timestamp: new Date().toISOString()
    });
  }
  
  switch (message.type) {
    case 'ping':
      addLog('INFO', 'Extension ping received, sending pong...');
      sendNativeMessage({ type: 'pong', timestamp: Date.now() });
      break;
    case 'setActivity':
      setActivity(message.activity).then(result => {
        if (result.success) {
          sendNativeMessage({ type: 'activitySet', success: true });
        } else {
          sendNativeMessage({ type: 'error', error: result.error });
        }
      });
      break;
    case 'clearActivity':
      clearActivity().then(result => {
        if (result.success) {
          sendNativeMessage({ type: 'activityCleared', success: true });
        } else {
          sendNativeMessage({ type: 'error', error: result.error });
        }
      });
      break;
    default:
      addLog('WARN', 'Unknown message type:', message.type);
      sendNativeMessage({ type: 'error', error: 'Unknown message type' });
  }
}

function sendNativeMessage(message) {
  if (process.stdin.isTTY !== false) {
    return; // Not in native messaging mode
  }
  
  try {
    const buffer = Buffer.from(JSON.stringify(message), 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);
    
    process.stdout.write(header);
    process.stdout.write(buffer);
    
    addLog('INFO', 'Sent to extension:', message.type);
  } catch (error) {
    addLog('ERROR', 'Error sending native message:', error.message);
  }
}

// App lifecycle
app.whenReady().then(() => {
  addLog('INFO', 'Discord Rich Presence Desktop App started');
  addLog('INFO', 'Version:', app.getVersion());
  addLog('INFO', 'Electron:', process.versions.electron);
  addLog('INFO', 'Node:', process.versions.node);
  
  createWindow();
  createTray();
  
  // Send initial connected message for native messaging
  if (process.stdin.isTTY === false) {
    sendNativeMessage({ type: 'connected' });
  }
});

app.on('window-all-closed', () => {
  // Don't quit - keep running in tray
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  
  if (discordClient) {
    try {
      await discordClient.destroy();
    } catch (error) {
      addLog('ERROR', 'Error destroying Discord client:', error.message);
    }
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  addLog('ERROR', 'Uncaught exception:', error.message);
  console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  addLog('ERROR', 'Unhandled rejection:', reason);
  console.error(reason);
});
