# Discord Rich Presence for Web Apps - English Instructions

## What does this tool do?

This tool allows you to display web applications (that you have installed as "desktop apps" or simply use in the browser) as Discord activity. This way your friends can see which web apps you are currently using.

### Example

When you watch YouTube in the browser, Discord can display:
```
🎮 Playing YouTube
📺 Watching videos
⏱️ for 15 minutes
```

## How does it work technically?

```
┌─────────────────────┐
│  Web App (Browser)  │
│   e.g. YouTube      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Browser Extension  │ ← You configure the apps here
└──────────┬──────────┘
           │
           ↓ Native Messaging
┌─────────────────────┐
│   Native Host       │
│    (Node.js)        │
└──────────┬──────────┘
           │
           ↓ Discord RPC
┌─────────────────────┐
│   Discord App       │ ← Shows your activity
└─────────────────────┘
```

## Installation

### 1. Check Prerequisites

Open a command line (CMD/PowerShell/Terminal) and check:

```bash
node --version
# Should be v14 or higher
```

### 2. Download and Install Dependencies

```bash
git clone https://github.com/your-username/discord-rich-presence-web
cd discord-rich-presence-web
npm install
```

### 3. Install Native Host

This installs the bridge between browser and Discord:

```bash
npm run install-host
```

### 4. Install Browser Extension

#### For Chrome/Edge:
1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder from this project

#### For Firefox:
1. Open `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on"**
3. Select `extension/manifest-firefox.json` (NOT the regular manifest.json!)

### 5. Start Desktop App (Optional)

```bash
npm run app
```

The desktop app provides additional features like logs and test functions.

## Configuration

### 1. Create Discord Application

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Copy the **Application ID** (18-19 digits)
4. Optional: Upload images under "Rich Presence" → "Art Assets"
   - These names you will use later in the extension configuration

### 2. Configure Extension

1. Open a website you want to display as Discord activity
2. Click on the extension icon in your browser
3. Fill out the form:
   - **App Name**: Name that appears in Discord
   - **Details**: Main description text
   - **State**: Additional status text
   - **Large Image Key**: Name for large image (optional)
   - **Large Image Text**: Hover text for the image
   - **Small Image Key**: Name for small image (optional)
   - **Small Image Text**: Hover text for small image
4. Click **"Add/Update Page"**

### 3. Test

1. Make sure Discord Desktop is running
2. Go to Discord → Settings → Activity Status
3. Enable "Display current activity as a status message"
4. Open the configured website
5. Your activity should now appear in Discord!

## Troubleshooting

### Common Issues

**Problem:** Extension not working
```bash
# Check if Node.js is in PATH
node --version
npm --version
```

**Solution:**
1. Check if the extension ID is correctly registered
2. Restart the browser completely
3. Test the connection via the "Test Connection" button in the popup

### Debug Mode

1. Enable debug logs
2. Activity status must be enabled in Discord

**Problem:** Native Host Connection Failed

**Solution:**
- Check if native host is properly installed: `npm run install-host`
- Restart browser after installation
- Check browser console for error messages

### Extension Logs

#### Chrome/Edge:
1. Go to `chrome://extensions/`
2. Find your extension
3. Click on "background page" or "service worker"
4. Check console for errors

#### Firefox:
1. Go to `about:debugging#/runtime/this-firefox`
2. Find your extension
3. Click "Inspect"
4. Check console for errors

## Features

### Desktop App
- **Logs**: View all communication between extension and Discord
- **Test**: Test activities without browser
- **Settings**: Store global Discord Application ID
- **Connection Status**: See if Discord is connected

### Browser Extension
- **Per-Site Configuration**: Different settings for each website
- **Enable/Disable**: Toggle activity for specific sites
- **Automatic Detection**: Activity updates automatically when you switch tabs

## Advanced Usage

### Custom Images

1. Upload images to your Discord application
2. Name them (e.g., "youtube", "spotify")
3. Use these names in the extension configuration

### Multiple Applications

You can create multiple Discord applications and use different Application IDs for different websites.

### API Usage

The tool also provides a programmatic API for developers who want to integrate Rich Presence into their own applications.

## Security

- All data is stored locally on your computer
- No data is sent to external servers (except Discord)
- The Discord Application ID is encrypted and stored securely
- Extension only accesses websites you explicitly configure

## Supported Platforms

- **Operating Systems**: Windows, macOS, Linux
- **Browsers**: Chrome, Firefox, Edge
- **Discord**: Desktop app required (browser version not supported)

## Contributing

Contributions are welcome! Please check the main README.md for development setup instructions.

## License

This project is licensed under the MIT License.