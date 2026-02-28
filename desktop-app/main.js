const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const DiscordClient = require('../lib/DiscordClient');

const WS_PORT = 7890;

let mainWindow = null;
let tray = null;
let discordClient = null;
let wss = null;
let logs = [];
const MAX_LOGS = 1000;
let extensionConnected = false;
let lastExtensionPing = null;
let storedClientId = null;
let appSettings = {
  quitOnClose: false
};

// Track connected WebSocket clients
const wsClients = new Set();

// Log function
function addLog(level, ...args) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const message = args.join(' ');
  const logEntry = { timestamp, level, message };
  
  logs.push(logEntry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log', logEntry);
  }
  
  console.log(`[${level}]`, ...args);
}

// Get the path for the stored Discord key
function getStoredKeyPath() {
  return path.join(app.getPath('userData'), 'discord-key.enc');
}

// Get the path for app settings
function getAppSettingsPath() {
  return path.join(app.getPath('userData'), 'app-settings.json');
}

// Load app settings from disk
function loadAppSettings() {
  try {
    const settingsPath = getAppSettingsPath();
    
    if (!fs.existsSync(settingsPath)) {
      return { quitOnClose: false };
    }
    
    const data = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(data);
    return settings;
  } catch (error) {
    addLog('ERROR', 'Failed to load app settings:', error.message);
    return { quitOnClose: false };
  }
}

// Save app settings to disk
function saveAppSettings(settings) {
  try {
    const settingsPath = getAppSettingsPath();
    
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    appSettings = settings;
    addLog('INFO', 'App settings saved');
    
    return { success: true };
  } catch (error) {
    addLog('ERROR', 'Failed to save app settings:', error.message);
    return { success: false, error: error.message };
  }
}

// Load stored client ID from disk
function loadStoredClientId() {
  try {
    const keyPath = getStoredKeyPath();
    
    if (!fs.existsSync(keyPath)) {
      return null;
    }
    
    const encryptedData = fs.readFileSync(keyPath);
    
    if (safeStorage.isEncryptionAvailable()) {
      const decryptedKey = safeStorage.decryptString(encryptedData);
      return decryptedKey;
    } else {
      try {
        const jsonData = JSON.parse(encryptedData.toString());
        addLog('WARN', 'Encryption not available, using plaintext storage');
        return jsonData.clientId || null;
      } catch (error) {
        addLog('ERROR', 'Failed to read stored key (fallback):', error.message);
        return null;
      }
    }
  } catch (error) {
    addLog('ERROR', 'Failed to load stored client ID:', error.message);
    return null;
  }
}

// Save client ID to disk
function saveClientId(clientId) {
  try {
    const keyPath = getStoredKeyPath();
    
    if (!clientId || clientId.trim() === '') {
      try {
        if (fs.existsSync(keyPath)) {
          fs.unlinkSync(keyPath);
          addLog('INFO', 'Stored client ID cleared');
        }
        storedClientId = null;
        return { success: true };
      } catch (error) {
        addLog('ERROR', 'Failed to clear stored client ID:', error.message);
        return { success: false, error: error.message };
      }
    }
    
    if (typeof clientId !== 'string') {
      throw new Error('Valid client ID is required');
    }
    
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedData = safeStorage.encryptString(clientId);
      fs.writeFileSync(keyPath, encryptedData);
      addLog('INFO', 'Client ID saved securely');
    } else {
      const jsonData = { clientId, warning: 'Stored in plaintext - encryption not available' };
      fs.writeFileSync(keyPath, JSON.stringify(jsonData, null, 2));
      addLog('WARN', 'Client ID saved in plaintext (encryption not available)');
    }
    
    storedClientId = clientId;
    
    return { success: true };
  } catch (error) {
    addLog('ERROR', 'Failed to save client ID:', error.message);
    return { success: false, error: error.message };
  }
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
      // Notify all connected extensions
      broadcastToExtensions({ type: 'discordConnected', user });
    },
    onDisconnected: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('discord-disconnected');
      }
      broadcastToExtensions({ type: 'discordDisconnected' });
    },
    onError: (error) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('discord-error', error.message);
      }
      broadcastToExtensions({ type: 'error', error: error.message });
    },
    onActivitySet: (activity) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('activity-set', activity);
      }
      broadcastToExtensions({ type: 'activitySet', success: true });
    },
    onActivityCleared: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('activity-cleared');
      }
      broadcastToExtensions({ type: 'activityCleared', success: true });
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
  
  if (!activityData.clientId && storedClientId) {
    activityData.clientId = storedClientId;
    addLog('INFO', 'Using stored client ID as fallback');
  }
  
  if (!activityData.clientId) {
    const error = 'No Discord Application ID configured. Please set one in Settings.';
    addLog('ERROR', error);
    return { success: false, error };
  }
  
  return await client.setActivity(activityData);
}

// Clear Discord activity
async function clearActivity() {
  const client = initializeDiscordClient();
  return await client.clearActivity();
}

// ============================================================
// WebSocket Server - Communication with Browser Extension
// ============================================================

function startWebSocketServer() {
  wss = new WebSocketServer({ port: WS_PORT, host: '127.0.0.1' });
  
  wss.on('listening', () => {
    console.log(`\n  ORGN Discord Bridge`);
    console.log(`  WebSocket server listening on ws://127.0.0.1:${WS_PORT}\n`);
    addLog('INFO', `WebSocket server started on ws://127.0.0.1:${WS_PORT}`);
  });
  
  wss.on('connection', (ws) => {
    wsClients.add(ws);
    extensionConnected = true;
    lastExtensionPing = Date.now();
    
    addLog('INFO', 'Browser extension connected via WebSocket');
    
    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('extension-message', {
        type: 'connected',
        timestamp: new Date().toISOString()
      });
    }
    
    // Send current status to newly connected extension
    const client = discordClient || initializeDiscordClient();
    const status = client.getStatus();
    ws.send(JSON.stringify({
      type: 'welcome',
      discordConnected: status.connected,
      user: status.user,
      storedClientId: storedClientId ? true : false
    }));
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleExtensionMessage(ws, message);
      } catch (error) {
        addLog('ERROR', 'Failed to parse WebSocket message:', error.message);
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      }
    });
    
    ws.on('close', () => {
      wsClients.delete(ws);
      addLog('INFO', 'Browser extension disconnected');
      
      if (wsClients.size === 0) {
        extensionConnected = false;
      }
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension-message', {
          type: 'disconnected',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    ws.on('error', (error) => {
      addLog('ERROR', 'WebSocket client error:', error.message);
      wsClients.delete(ws);
    });
  });
  
  wss.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      addLog('ERROR', `Port ${WS_PORT} is already in use. Is another instance running?`);
    } else {
      addLog('ERROR', 'WebSocket server error:', error.message);
    }
  });
}

// Handle messages from extension
function handleExtensionMessage(ws, message) {
  addLog('INFO', 'Received from extension:', message.type);
  
  extensionConnected = true;
  lastExtensionPing = Date.now();
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('extension-message', {
      type: message.type,
      timestamp: new Date().toISOString()
    });
  }
  
  switch (message.type) {
    case 'ping':
      addLog('INFO', 'Extension ping received');
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
      
    case 'setActivity': {
      const activityData = {
        clientId: message.clientId || message.activity?.clientId || storedClientId,
        activity: message.activity
      };
      
      setActivity(activityData).then(result => {
        ws.send(JSON.stringify(
          result.success
            ? { type: 'activitySet', success: true }
            : { type: 'error', error: result.error }
        ));
      });
      break;
    }
    
    case 'clearActivity':
      clearActivity().then(result => {
        ws.send(JSON.stringify(
          result.success
            ? { type: 'activityCleared', success: true }
            : { type: 'error', error: result.error }
        ));
      });
      break;
      
    case 'getStatus': {
      const client = discordClient || initializeDiscordClient();
      const status = client.getStatus();
      ws.send(JSON.stringify({
        type: 'status',
        discordConnected: status.connected,
        user: status.user,
        activity: status.activity,
        storedClientId: storedClientId ? true : false
      }));
      break;
    }
    
    default:
      addLog('WARN', 'Unknown message type from extension:', message.type);
      ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
  }
}

// Broadcast message to all connected extension clients
function broadcastToExtensions(message) {
  const data = JSON.stringify(message);
  for (const client of wsClients) {
    try {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(data);
      }
    } catch (error) {
      addLog('ERROR', 'Error broadcasting to extension:', error.message);
    }
  }
}

// ============================================================
// Electron Window & Tray
// ============================================================

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
    skipTaskbar: true,
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting && !appSettings.quitOnClose) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logs.forEach(log => {
      mainWindow.webContents.send('log', log);
    });
    
    const client = initializeDiscordClient();
    const status = client.getStatus();
    
    if (status.connected) {
      mainWindow.webContents.send('discord-connected', status.user);
    }
    
    if (status.activity) {
      mainWindow.webContents.send('activity-set', status.activity.activity);
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'ORGN Discord Bridge',
      enabled: false
    },
    { type: 'separator' },
    {
      label: mainWindow && mainWindow.isVisible() ? 'Fenster verstecken' : 'Fenster anzeigen',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        } else {
          createWindow();
          mainWindow.show();
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
      label: app.isPackaged ? 'Start with system' : 'Start with system (nur in installierter Version)',
      type: 'checkbox',
      checked: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false,
      enabled: app.isPackaged,
      click: (menuItem) => {
        if (!app.isPackaged) {
          addLog('WARN', 'Autostart funktioniert nur in der installierten Version');
          return;
        }
        
        const options = {
          openAtLogin: menuItem.checked,
          openAsHidden: true
        };
        
        if (process.platform === 'darwin') {
          options.path = app.getPath('exe');
        }
        
        if (process.platform === 'linux') {
          const os = require('os');
          const desktopFilePath = path.join(os.homedir(), '.config', 'autostart', 'discord-rpc.desktop');
          
          if (menuItem.checked) {
            const autostartDir = path.dirname(desktopFilePath);
            if (!fs.existsSync(autostartDir)) {
              fs.mkdirSync(autostartDir, { recursive: true });
            }
            
            const desktopContent = `[Desktop Entry]
Type=Application
Name=ORGN Discord Bridge
Exec=${process.execPath} ${process.argv.slice(1).join(' ')}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
`;
            
            fs.writeFileSync(desktopFilePath, desktopContent);
            addLog('INFO', 'Autostart enabled via tray menu');
          } else {
            if (fs.existsSync(desktopFilePath)) {
              fs.unlinkSync(desktopFilePath);
              addLog('INFO', 'Autostart disabled via tray menu');
            }
          }
        } else {
          app.setLoginItemSettings(options);
          addLog('INFO', `Autostart ${menuItem.checked ? 'enabled' : 'disabled'} via tray menu`);
        }
        
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: `Extension: ${extensionConnected ? 'Connected' : 'Not connected'}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

function createTray() {
  // Use dedicated tray icons (transparent background, works on light and dark taskbars)
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../extension/icons/tray16.png')
    : path.join(__dirname, '../extension/icons/tray32.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon);
  
  updateTrayMenu();
  
  tray.setToolTip('ORGN Discord Bridge');
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    } else {
      createWindow();
      mainWindow.show();
    }
    updateTrayMenu();
  });
}

// ============================================================
// IPC Handlers
// ============================================================

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
    clientCount: wsClients.size,
    lastPing: lastExtensionPing,
    timeSinceLastPing: timeSinceLastPing,
    wsPort: WS_PORT
  };
});

ipcMain.handle('test-connection', async (event, clientId) => {
  const client = initializeDiscordClient();
  return await client.testConnection(clientId);
});

ipcMain.handle('get-client-id', () => {
  return storedClientId;
});

ipcMain.handle('save-client-id', (event, clientId) => {
  return saveClientId(clientId);
});

ipcMain.handle('get-storage-info', () => {
  return {
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    storageLocation: getStoredKeyPath(),
    hasStoredKey: storedClientId !== null
  };
});

ipcMain.handle('get-app-settings', () => {
  return appSettings;
});

ipcMain.handle('save-app-settings', (event, settings) => {
  return saveAppSettings(settings);
});

// Autostart handlers
ipcMain.handle('get-autostart', () => {
  try {
    if (!app.isPackaged) {
      return { 
        enabled: false, 
        isDevelopment: true,
        message: 'Autostart is only available in the installed version.'
      };
    }
    return { enabled: app.getLoginItemSettings().openAtLogin, isDevelopment: false };
  } catch (error) {
    addLog('ERROR', 'Failed to get autostart setting:', error.message);
    return { enabled: false, isDevelopment: false, error: error.message };
  }
});

ipcMain.handle('set-autostart', (event, { enabled }) => {
  try {
    if (!app.isPackaged) {
      const message = 'Autostart only works in installed version. Use "npm run build:win/mac/linux" to create an installable build.';
      addLog('WARN', message);
      return { success: false, isDevelopment: true, error: message };
    }
    
    const options = { openAtLogin: enabled, openAsHidden: true };
    
    if (process.platform === 'darwin') {
      options.path = app.getPath('exe');
    }
    
    if (process.platform === 'linux') {
      const os = require('os');
      const desktopFilePath = path.join(os.homedir(), '.config', 'autostart', 'discord-rpc.desktop');
      
      if (enabled) {
        const autostartDir = path.dirname(desktopFilePath);
        if (!fs.existsSync(autostartDir)) {
          fs.mkdirSync(autostartDir, { recursive: true });
        }
        
        const desktopContent = `[Desktop Entry]
Type=Application
Name=ORGN Discord Bridge
Exec=${process.execPath} ${process.argv.slice(1).join(' ')}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
`;
        
        fs.writeFileSync(desktopFilePath, desktopContent);
        addLog('INFO', 'Autostart enabled (Linux desktop file created)');
      } else {
        if (fs.existsSync(desktopFilePath)) {
          fs.unlinkSync(desktopFilePath);
          addLog('INFO', 'Autostart disabled (Linux desktop file removed)');
        }
      }
    } else {
      app.setLoginItemSettings(options);
      addLog('INFO', `Autostart ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    if (typeof updateTrayMenu === 'function') {
      updateTrayMenu();
    }
    
    return { success: true };
  } catch (error) {
    addLog('ERROR', 'Failed to set autostart:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================================
// App Lifecycle
// ============================================================

app.whenReady().then(() => {
  addLog('INFO', 'ORGN Discord Bridge started');
  addLog('INFO', 'Version:', app.getVersion());
  addLog('INFO', 'Electron:', process.versions.electron);
  addLog('INFO', 'Node:', process.versions.node);
  
  storedClientId = loadStoredClientId();
  if (storedClientId) {
    addLog('INFO', 'Loaded stored Discord client ID');
  }
  
  appSettings = loadAppSettings();
  addLog('INFO', 'App settings loaded. Quit on close:', appSettings.quitOnClose);
  
  // Start WebSocket server for extension communication
  startWebSocketServer();
  
  createTray();
  createWindow();
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
  
  // Close WebSocket server
  if (wss) {
    for (const client of wsClients) {
      try {
        client.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    wss.close();
    addLog('INFO', 'WebSocket server stopped');
  }
  
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
