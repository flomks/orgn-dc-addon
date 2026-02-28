# DiscordClient API

Shared Discord RPC client used by the desktop app. Handles connection management, reconnection with exponential backoff, and activity lifecycle.

## Usage

```javascript
const DiscordClient = require('../lib/DiscordClient');

const client = new DiscordClient({
  onReady: (user) => console.log('Connected as', user.username),
  onDisconnected: () => console.log('Disconnected'),
  onError: (error) => console.error(error.message),
  onActivitySet: (activity) => console.log('Activity set'),
  onActivityCleared: () => console.log('Activity cleared'),
  onLog: (level, ...args) => console.log(`[${level}]`, ...args)
});
```

## Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `reconnectDelay` | number | 5000 | Base delay in ms for reconnection |
| `maxReconnectAttempts` | number | 10 | Max reconnection attempts |
| `onReady` | function | - | Called when connected to Discord `(user) => {}` |
| `onDisconnected` | function | - | Called on disconnect `() => {}` |
| `onError` | function | - | Called on error `(error) => {}` |
| `onActivitySet` | function | - | Called when activity is set `(activity) => {}` |
| `onActivityCleared` | function | - | Called when activity is cleared `() => {}` |
| `onLog` | function | - | Log callback `(level, ...args) => {}` |

## Methods

### `setActivity(activityData)`

Sets Discord Rich Presence.

```javascript
const result = await client.setActivity({
  clientId: '1234567890123456789',
  activity: {
    details: 'Watching videos',
    state: 'Entertainment',
    largeImageKey: 'youtube',
    largeImageText: 'YouTube'
  }
});

if (!result.success) {
  console.error(result.error);
}
```

### `clearActivity()`

Clears the current activity.

```javascript
const result = await client.clearActivity();
```

### `testConnection(clientId)`

Tests connection to Discord.

```javascript
const result = await client.testConnection('1234567890123456789');
// { success: true, user: { username: '...' } }
```

### `getStatus()`

Returns current state.

```javascript
const status = client.getStatus();
// { connected, connecting, user, activity, reconnectAttempts, ... }
```

### `destroy()`

Cleans up all resources. Call this on app shutdown.

```javascript
await client.destroy();
```

## Reconnection

The client reconnects automatically when Discord disconnects:

1. Exponential backoff: 5s, 10s, 20s, 30s max
2. Restores the last activity after reconnecting
3. Stops after `maxReconnectAttempts`

## Error Handling

Methods return `{ success, error? }` objects instead of throwing:

```javascript
const result = await client.setActivity(data);
if (!result.success) {
  console.error('Failed:', result.error);
}
```
