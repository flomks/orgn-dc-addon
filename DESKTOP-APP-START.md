# ORGN Discord Bridge - Starting the Desktop App

There are several ways to start the desktop app:

## Option 1: Start Scripts (Recommended for Development)

### Windows
Double-click on:
```
start-app.bat
```

### macOS / Linux
Execute in terminal:
```bash
./start-app.sh
```

Or double-click (if marked as executable).

## Option 2: NPM Command

In terminal:
```bash
npm run app
```

## Option 3: Create Desktop Shortcut (Windows)

1. Double-click on `create-desktop-shortcut.bat`
2. A shortcut "ORGN Discord Bridge" will be created on your desktop
3. From now on you can start the app via the desktop shortcut

**Note:** This only creates a shortcut to the development version!

## For Autostart: Create Installable Version

The autostart function only works in the installed version:

### Windows (Create Installer)
```bash
npm run build:win
```
Output: `dist/ORGN Discord Bridge Setup.exe`

After installation:
- App appears in Start Menu
- Autostart can be enabled in Settings
- App runs as normal Windows application

### macOS (Create DMG)
```bash
npm run build:mac
```
Output: `dist/ORGN Discord Bridge.dmg`

### Linux (Create AppImage/DEB)
```bash
npm run build:linux
```
Output: 
- `dist/ORGN Discord Bridge.AppImage`
- `dist/orgn-discord-bridge.deb`

## Difference: Development vs. Production

| Feature | Development (`start-app.bat`) | Production (after build) |
|---------|-------------------------------|-------------------------|
| Starting | Manually via script/npm | Via Start Menu/Desktop |
| Autostart | ❌ Disabled | ✅ Works |
| Updates | Immediately after code change | Must be rebuilt |
| Performance | Slower (dev tools active) | Faster (optimized) |
| Usage | Development & Testing | Daily use |

## Troubleshooting

### "node_modules not found"
```bash
npm install
```

### "Electron not installed"
```bash
npm install electron --save-dev
```

### App won't start
1. Open terminal
2. Execute: `npm run app`
3. Pay attention to error messages

### Desktop shortcut doesn't work (Windows)
Create manual shortcut:
1. Right-click on desktop → New → Shortcut
2. Browse → select `start-app.bat`
3. Name: "ORGN Discord Bridge"
4. Finish
