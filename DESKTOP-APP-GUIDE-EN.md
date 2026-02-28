# Desktop App - Guide

## 🎉 New Desktop App with GUI!

Instead of the Native Host running invisibly in the background (and VS Code opening), there is now a **beautiful desktop application with GUI**!

## ✨ Features

- ✅ **Real Window** - No command line, no VS Code
- ✅ **Live Logs** - See all activities in real-time
- ✅ **Discord Status** - Connection and user info
- ✅ **Activity Monitor** - What's currently running
- ✅ **Test Area** - Test activities directly in the app
- ✅ **System Tray** - Runs minimized in background
- ✅ **Beautiful UI** - Discord-style design

## 🚀 Starting

### Option 1: As Desktop App (recommended)

```bash
npm run app
```

**What happens:**
- Window opens
- Beautiful GUI with tabs (Dashboard, Logs, Test)
- Continues running in system tray when minimized
- No command line visible

### Option 2: With Browser Extension

The Desktop App can also work as Native Host for the browser extension!

**Setup:**

1. **Register Native Host (but with Desktop App):**

Edit the manifest file manually:

**Windows:**
```
%LOCALAPPDATA%\discord-rpc-native-host\com.discord.richpresence.webapp.json
```

**Mac:**
```
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.discord.richpresence.webapp.json
```

**Linux:**
```
~/.config/google-chrome/NativeMessagingHosts/com.discord.richpresence.webapp.json
```

2. **Change the path** from `native-host/index.js` to point to the desktop app:

**Windows:**
```json
{
  "name": "com.discord.richpresence.webapp",
  "description": "Discord Rich Presence for Web Apps",
  "path": "C:\\path\\to\\your\\project\\desktop-app\\main.bat",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://your-extension-id/"
  ]
}
```

**Mac/Linux:**
```json
{
  "name": "com.discord.richpresence.webapp",
  "description": "Discord Rich Presence for Web Apps",
  "path": "/path/to/your/project/desktop-app/main.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://your-extension-id/"
  ]
}
```

3. **Start the desktop app:**
```bash
npm run app
```

4. **Test in browser:**
- Configure a website in the extension
- Visit the website
- Desktop app shows the activity in the GUI!

## 🎮 Features Overview

### Dashboard Tab
- **Discord Connection Status** - See if Discord is connected
- **Current User** - Which Discord user is connected
- **Current Activity** - Live preview of what's currently displayed
- **Quick Actions** - Clear activity, test connection

### Logs Tab
- **Real-time Logs** - All communication between extension and Discord
- **Color-coded Messages** - Success (green), Error (red), Info (blue)
- **Auto-scroll** - Always see the latest logs
- **Clear Function** - Clean up logs

### Test Tab
- **Activity Testing** - Test Rich Presence without browser
- **All Fields** - Details, State, Images, etc.
- **Application ID** - Use stored ID or enter custom ID
- **Live Preview** - See exactly what Discord will show

### Settings Tab
- **Global Settings** - Store Discord Application ID encrypted
- **App Settings** - Configure desktop app behavior
- **Autostart** - Start with system (only in installed version)
- **Storage Info** - See where data is stored

## 🔧 Technical Details

### How it works:

1. **Desktop App starts** → Creates Electron window
2. **Browser Extension sends data** → Via Native Messaging
3. **Desktop App receives data** → Shows in GUI and forwards to Discord
4. **Discord displays activity** → Your friends see what you're doing

### Files:
- `desktop-app/main.js` - Main Electron process
- `desktop-app/renderer.js` - GUI logic
- `desktop-app/index.html` - GUI layout
- `desktop-app/styles.css` - GUI styling
- `desktop-app/main.bat` - Windows startup script for native host
- `desktop-app/main.sh` - Unix startup script for native host

## 🎨 GUI Preview

```
┌─────────────────────────────────────────┐
│ ORGN Discord Bridge            [- □ ×] │
├─────────────────────────────────────────┤
│ Dashboard │ Logs │ Test │ Settings     │
├─────────────────────────────────────────┤
│                                         │
│ Discord Connection                      │
│ Status: Connected ●                     │
│ User: YourUsername#1234                 │
│                                         │
│ Current Activity                        │
│ ┌─────────────────────────────────────┐ │
│ │ 🎮 Playing YouTube                  │ │
│ │ 📺 Watching cat videos             │ │
│ │ ⏱️ for 5 minutes                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Quick Actions                           │
│ [Clear Activity] [Test Connection]      │
│                                         │
└─────────────────────────────────────────┘
```

## ⚡ Performance

- **Fast startup** - App is ready in < 2 seconds
- **Low memory** - Uses ~50-100MB RAM
- **Background mode** - Minimal CPU when minimized
- **Efficient** - Only processes data when needed

## 🔧 Troubleshooting

### App won't start
```bash
# Check if all dependencies are installed
npm install

# Try running with debug output
npm run app:debug
```

### Extension connection fails
1. Check if manifest file path is correct
2. Restart browser after changing manifest
3. Check desktop app logs tab for errors

### Discord not showing activity
1. Make sure Discord Desktop app is running (not browser)
2. Check Discord settings: Activity Status must be enabled
3. Test with the built-in test tab

### System tray icon missing
- Windows: Check "Hidden icons" in taskbar
- Mac: Check if "Keep in Dock" is enabled
- Linux: Depends on desktop environment

## 🚀 Production Build

For daily use, create an installable version:

```bash
# Windows
npm run build:win
# Creates: dist/ORGN Discord Bridge Setup.exe

# Mac  
npm run build:mac
# Creates: dist/ORGN Discord Bridge.dmg

# Linux
npm run build:linux  
# Creates: dist/ORGN Discord Bridge.AppImage
```

**Advantages of installed version:**
- Autostart with system
- Better performance
- System integration
- Auto-updater (future)

## 🎯 Best Practices

1. **Always keep Discord Desktop running** - Browser version won't work
2. **Use descriptive activity texts** - Help friends understand what you're doing  
3. **Upload custom images** - Makes activities more visual
4. **Test before deploying** - Use the test tab to verify everything works
5. **Keep app minimized** - Runs efficiently in system tray

## 🔮 Future Features

- [ ] Auto-updater
- [ ] Multiple Discord accounts
- [ ] Activity templates
- [ ] Statistics and usage tracking
- [ ] Plugin system for custom activities