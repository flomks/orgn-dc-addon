# DiscordClient API Documentation

## Overview

The `DiscordClient` class provides centralized lifecycle management for Discord RPC connections. It eliminates duplicate code between the desktop app and native host by providing a clean, event-driven API for Discord Rich Presence functionality.

## Features

- **Centralized Connection Management**: Single point of responsibility for Discord RPC connections
- **Automatic Reconnection**: Intelligent reconnection with exponential backoff
- **Event-Driven Architecture**: Callbacks for all major lifecycle events
- **Activity Lifecycle**: Complete management of Rich Presence activities
- **Error Handling**: Comprehensive error handling and logging
- **Resource Management**: Proper cleanup and resource management

## Constructor

```javascript
const client = new DiscordClient(options);
```

### Options

- `reconnectDelay` (number, default: 5000): Base delay in ms for reconnection attempts
- `maxReconnectAttempts` (number, default: 10): Maximum number of reconnection attempts
- `onReady` (function): Callback when connection is established `(user) => {}`
- `onDisconnected` (function): Callback when connection is lost `() => {}`
- `onError` (function): Callback for errors `(error) => {}`
- `onActivitySet` (function): Callback when activity is set `(activity) => {}`
- `onActivityCleared` (function): Callback when activity is cleared `() => {}`
- `onLog` (function): Callback for log messages `(level, ...args) => {}`

## Properties

### `client.isConnected` (getter)
Returns boolean indicating if currently connected to Discord.

### `client.user` (getter)
Returns current Discord user object or null if not connected.

### `client.activity` (getter)
Returns current activity data or null if no activity is set.

## Methods

### `connect(clientId)`
Connects to Discord with the specified client ID.

**Parameters:**
- `clientId` (string): Discord application client ID

**Returns:** Promise that resolves to Discord client instance

**Example:**
```javascript
try {
  const client = await discordClient.connect('1234567890123456789');
  console.log('Connected as:', client.user.username);
} catch (error) {
  console.error('Connection failed:', error.message);
}
```

### `setActivity(activityData)`
Sets Discord Rich Presence activity.

**Parameters:**
- `activityData` (object):
  - `clientId` (string): Discord application client ID
  - `activity` (object): Rich Presence activity object
    - `details` (string): Primary activity description
    - `state` (string): Secondary activity description
    - `startTimestamp` (number): Activity start time
    - `largeImageKey` (string): Large image asset key
    - `largeImageText` (string): Large image hover text
    - `smallImageKey` (string): Small image asset key
    - `smallImageText` (string): Small image hover text

**Returns:** Promise that resolves to `{ success: boolean, error?: string }`

**Example:**
```javascript
const result = await discordClient.setActivity({
  clientId: '1234567890123456789',
  activity: {
    details: 'Browsing YouTube',
    state: 'Watching videos',
    largeImageKey: 'youtube',
    largeImageText: 'YouTube'
  }
});

if (result.success) {
  console.log('Activity set successfully');
} else {
  console.error('Failed to set activity:', result.error);
}
```

### `clearActivity()`
Clears the current Discord Rich Presence activity.

**Returns:** Promise that resolves to `{ success: boolean, error?: string }`

**Example:**
```javascript
const result = await discordClient.clearActivity();
if (result.success) {
  console.log('Activity cleared');
}
```

### `disconnect()`
Disconnects from Discord and clears reconnection timers.

**Returns:** Promise that resolves when disconnection is complete

### `destroy()`
Destroys the client instance and cleans up all resources. Once destroyed, the client cannot be reused.

**Returns:** Promise that resolves when cleanup is complete

### `testConnection(clientId)`
Tests connection to Discord with optional client ID.

**Parameters:**
- `clientId` (string, optional): Discord application client ID (defaults to test ID)

**Returns:** Promise that resolves to `{ success: boolean, error?: string, user?: object }`

### `getStatus()`
Returns current status information.

**Returns:** Object with current state information:
```javascript
{
  connected: boolean,
  connecting: boolean,
  user: object | null,
  activity: object | null,
  reconnectAttempts: number,
  maxReconnectAttempts: number,
  hasReconnectTimer: boolean,
  destroyed: boolean
}
```

## Usage Examples

### Desktop Application Integration

```javascript
const DiscordClient = require('../lib/DiscordClient');

// Initialize with Electron IPC integration
const discordClient = new DiscordClient({
  onReady: (user) => {
    if (mainWindow) {
      mainWindow.webContents.send('discord-connected', user);
    }
  },
  onDisconnected: () => {
    if (mainWindow) {
      mainWindow.webContents.send('discord-disconnected');
    }
  },
  onActivitySet: (activity) => {
    if (mainWindow) {
      mainWindow.webContents.send('activity-set', activity);
    }
  },
  onLog: (level, ...args) => {
    addLog(level.toUpperCase(), ...args);
  }
});

// IPC handlers
ipcMain.handle('set-activity', async (event, activityData) => {
  return await discordClient.setActivity(activityData);
});

ipcMain.handle('clear-activity', async () => {
  return await discordClient.clearActivity();
});
```

### Native Messaging Host Integration

```javascript
const DiscordClient = require('../lib/DiscordClient');

const discordClient = new DiscordClient({
  onReady: (user) => {
    sendMessage({ type: 'connected', user });
  },
  onActivitySet: () => {
    sendMessage({ type: 'activitySet', success: true });
  },
  onActivityCleared: () => {
    sendMessage({ type: 'activityCleared', success: true });
  },
  onError: (error) => {
    sendMessage({ type: 'error', error: error.message });
  },
  onLog: (level, ...args) => {
    log(...args);
  }
});

// Message handlers
async function handleSetActivity(activityData) {
  const result = await discordClient.setActivity(activityData);
  if (!result.success) {
    sendMessage({ type: 'error', error: result.error });
  }
}
```

## Reconnection Behavior

The DiscordClient automatically handles reconnection when Discord disconnects:

1. **Exponential Backoff**: Reconnection delays increase exponentially (5s, 10s, 20s, 30s max)
2. **Activity Restoration**: Automatically restores the last activity after reconnection
3. **Max Attempts**: Stops trying after reaching `maxReconnectAttempts`
4. **Graceful Degradation**: Continues operating even if reconnection fails

## Error Handling

All methods return success/error objects rather than throwing exceptions for operational errors:

```javascript
// Connection errors are caught and reported
const result = await client.setActivity(activityData);
if (!result.success) {
  console.error('Activity failed:', result.error);
}

// Only programming errors (invalid parameters) throw exceptions
try {
  await client.setActivity({ /* missing clientId */ });
} catch (error) {
  console.error('Programming error:', error.message);
}
```

## Lifecycle Management

```javascript
// Proper cleanup in application shutdown
app.on('before-quit', async () => {
  if (discordClient) {
    await discordClient.destroy();
  }
});

// Process signal handling
process.on('SIGTERM', async () => {
  await discordClient.destroy();
  process.exit(0);
});
```

## Migration Guide

### From Direct DiscordRPC Usage

**Before:**
```javascript
const DiscordRPC = require('discord-rpc');
let currentClient = null;
let reconnectTimer = null;

// Scattered connection logic
async function connect(clientId) {
  // ... duplicate connection code
}

// Duplicate reconnection handling
client.on('disconnected', () => {
  // ... duplicate reconnection logic
});
```

**After:**
```javascript
const DiscordClient = require('./lib/DiscordClient');

const discordClient = new DiscordClient({
  onReady: (user) => { /* handle ready */ },
  onDisconnected: () => { /* handle disconnect */ },
  // ... other event handlers
});

// Clean, centralized API
await discordClient.setActivity(activityData);
```

## Benefits

1. **DRY Principle**: Eliminates duplicate Discord RPC code
2. **Single Responsibility**: One class handles all Discord lifecycle concerns
3. **Testability**: Clean API makes testing easier
4. **Maintainability**: Changes only need to be made in one place
5. **Reliability**: Robust reconnection and error handling
6. **Consistency**: Uniform behavior across desktop app and native host