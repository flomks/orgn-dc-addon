# ORGN Discord Bridge

Show your favorite web apps as Discord Rich Presence activity.

```
DeinUsername
  Playing YouTube
  Watching videos
  for 15 minutes
```

## How It Works

```
Browser Extension  ---WebSocket--->  Desktop App  ---RPC--->  Discord
(detects websites)                   (Electron)              (shows activity)
```

The **browser extension** detects which configured websites you visit. It sends this information to the **desktop app** via WebSocket. The desktop app sets your **Discord Rich Presence** accordingly.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start the desktop app

```bash
npm run app
```

The app starts in the system tray. A window opens with Dashboard, Logs, Test, and Settings tabs.

### 3. Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Copy the **Application ID**
4. Optional: Upload images under "Rich Presence" > "Art Assets"

### 4. Configure the desktop app

1. Open the desktop app window (click the tray icon)
2. Go to the **Settings** tab
3. Paste your Application ID and save

### 5. Install the browser extension

**Chrome / Edge:**
1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder from this project

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `extension/manifest-firefox.json`

### 6. Configure a website

1. Open a website (e.g. youtube.com)
2. Click the extension icon in your browser toolbar
3. Fill in the form:
   - **App Name**: What shows in Discord (e.g. "YouTube")
   - **Details**: Description (e.g. "Watching videos")
   - **State**: Status text (e.g. "Entertainment")
   - **Large Image Key**: Asset name from your Discord Application
4. Click "Add/Update Site"
5. Check your Discord profile!

## Architecture

```
extension/
  background.js     WebSocket client, tab monitoring, storage
  popup.js          Configuration UI
  popup.html        Popup layout and styles
  manifest.json     Chrome/Edge extension manifest

desktop-app/
  main.js           Electron main process, WebSocket server, Discord RPC
  renderer.js       GUI logic (dashboard, logs, test, settings)
  preload.js        IPC bridge between main and renderer
  index.html        App layout
  styles.css        Discord-themed styling

lib/
  DiscordClient.js  Shared Discord RPC client with reconnection logic
```

### Communication Flow

1. You open youtube.com in Chrome
2. Extension background.js detects the tab change
3. background.js checks `chrome.storage.sync` for a matching app config
4. Config found: background.js sends `setActivity` via WebSocket to desktop app
5. Desktop app receives the message and calls Discord RPC
6. Discord shows "Playing YouTube" on your profile

### Extension <-> Desktop App Protocol

The extension connects to `ws://127.0.0.1:7890`. Messages are JSON:

```javascript
// Extension -> Desktop App
{ type: "ping" }
{ type: "setActivity", activity: { details, state, ... }, clientId: "..." }
{ type: "clearActivity" }
{ type: "getStatus" }

// Desktop App -> Extension
{ type: "pong", timestamp: 1234567890 }
{ type: "activitySet", success: true }
{ type: "activityCleared", success: true }
{ type: "welcome", discordConnected: true, user: {...} }
{ type: "error", error: "message" }
```

## Desktop App

### Starting

```bash
npm run app
```

The app runs in the system tray. Close the window to minimize it. Right-click the tray icon for options.

### Tabs

- **Dashboard**: Discord connection status, current activity, extension status
- **Logs**: Real-time log viewer for all events
- **Test**: Manually set a Discord activity without the extension
- **Settings**: Discord Application ID, app behavior, autostart

### Test Tab

Use the Test tab to verify your setup works before configuring the extension:
1. Enter your Discord Application ID
2. Fill in Details, State, and Image Keys
3. Click "Set Test Activity"
4. Check your Discord profile

## Browser Extension

### Popup UI

Click the extension icon to open the configuration popup:
- **Current Page**: Shows the current website hostname
- **App Configuration**: Form to set Rich Presence details for this site
- **Configured Apps**: List of all saved configurations
- **Test Connection**: Verifies the desktop app is reachable
- **Clear Activity**: Removes the current Discord activity

### Badge Indicator

The extension shows a badge on its icon:
- Green dot: Activity is being sent for this tab
- Red `!`: Desktop app is not connected

### Storage

Configurations are stored in `chrome.storage.sync`, which means they sync across your Chrome/Edge browsers if you are signed in.

## Troubleshooting

### Extension says "Desktop app not running"

The desktop app must be running for the extension to work.

```bash
npm run app
```

### Discord does not show activity

Checklist:
- [ ] Discord **Desktop** app is running (not the browser version)
- [ ] Activity Status is enabled in Discord Settings
- [ ] Application ID is correct (18-19 digit number)
- [ ] Desktop app shows "Connected" on the Dashboard tab
- [ ] Website is configured in the extension popup

### Extension badge shows red "!"

The extension cannot reach the desktop app. Make sure:
- Desktop app is running (`npm run app`)
- No firewall is blocking localhost port 7890

### Images not showing in Discord

- Asset names are case-sensitive: `youtube_logo` is not `YouTube_Logo`
- Assets take a few minutes to propagate after upload
- Use the exact name you gave the asset in the Discord Developer Portal

### Run diagnostics

```bash
npm run diagnose
```

This checks all components and reports issues.

## Building for Production

Create installable versions with autostart support:

```bash
npm run build:win     # Windows (.exe installer)
npm run build:mac     # macOS (.dmg)
npm run build:linux   # Linux (.AppImage, .deb)
```

The installed version supports:
- System autostart
- Start menu / application launcher integration
- Better performance

## Privacy

- Only websites you explicitly configure are detected
- Only the hostname is used for matching (e.g. `youtube.com`)
- No page content, URLs, cookies, or passwords are accessed
- Data is stored locally. Configurations sync via Chrome Sync if enabled.
- Communication between extension and desktop app is local only (localhost)

## Available Commands

```bash
npm run app           # Start the desktop app
npm run diagnose      # Run diagnostic checks
npm run build:win     # Build Windows installer
npm run build:mac     # Build macOS app
npm run build:linux   # Build Linux packages
npm run test          # Run tests
```

## License

MIT
