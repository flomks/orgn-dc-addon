# Discord Rich Presence für Web-Apps - Projektübersicht

## Projektstruktur

```
discord-richpresence-webapp-bridge/
├── extension/                  # Browser Extension
│   ├── manifest.json          # Chrome/Edge Manifest (V3)
│   ├── manifest-firefox.json  # Firefox Manifest (V2)
│   ├── background.js          # Service Worker (Native Messaging)
│   ├── content.js             # Content Script (Seiten-Erkennung)
│   ├── popup.html             # UI für Konfiguration
│   ├── popup.js               # UI Logik
│   └── icons/                 # Extension Icons
│       ├── icon16.svg
│       ├── icon32.svg
│       ├── icon48.svg
│       └── icon128.svg
│
├── native-host/               # Native Messaging Host
│   └── index.js              # Node.js RPC Bridge
│
├── scripts/                   # Hilfsskripte
│   ├── install-native-host.js    # Installation
│   ├── uninstall-native-host.js  # Deinstallation
│   ├── update-extension-id.js    # Extension ID registrieren
│   ├── check-installation.js     # Installation prüfen
│   └── test-native-host.js       # Native Host testen
│
├── examples/                  # Beispiele
│   ├── example-configs.json  # Vorgefertigte Konfigurationen
│   └── README.md             # Erklärung der Beispiele
│
├── package.json              # Node.js Konfiguration
├── README.md                 # Hauptdokumentation (Englisch)
├── ANLEITUNG-DE.md          # Deutsche Anleitung
├── SETUP.md                  # Setup-Guide
└── PROJECT.md                # Diese Datei
```

## Komponenten-Übersicht

### 1. Browser Extension

**Technologie:** Manifest V3 (Chrome/Edge), Manifest V2 (Firefox)

**Komponenten:**

- **background.js**: Service Worker
  - Verwaltet Verbindung zum Native Host
  - Tracked aktive Tabs
  - Sendet Activity-Updates

- **content.js**: Content Script
  - Läuft auf allen Webseiten
  - Erkennt Seitenänderungen (Titel, Sichtbarkeit)
  - Benachrichtigt Background Script

- **popup.html/js**: Popup UI
  - Konfiguration von Apps
  - Verwaltung gespeicherter Apps
  - Test-Funktionen

### 2. Native Messaging Host

**Technologie:** Node.js

**Funktionen:**
- Empfängt Nachrichten von Extension über stdin
- Sendet Nachrichten an Extension über stdout
- Verbindet sich mit Discord über IPC (discord-rpc)
- Setzt/Löscht Rich Presence Activity

**Protokoll:**
```
Browser Extension ←→ Native Host ←→ Discord Desktop App
     (JSON)              (stdin/stdout)      (IPC/RPC)
```

### 3. Installation Scripts

**install-native-host.js:**
- Erstellt Manifest-Dateien
- Registriert bei Browser (Registry/Filesystem)
- Macht Script ausführbar (Unix)

**update-extension-id.js:**
- Fügt Extension ID zu Manifest hinzu
- Erforderlich für Chrome/Edge

**check-installation.js:**
- Prüft alle Komponenten
- Hilfreich für Troubleshooting

## Datenfluss

### Activity Setzen

```
1. User öffnet YouTube
   ↓
2. Content Script erkennt Seite
   ↓
3. Background Script prüft Konfiguration
   ↓
4. Background sendet setActivity zu Native Host
   ↓
5. Native Host verbindet zu Discord
   ↓
6. Discord zeigt Activity im Profil
```

### Konfiguration

```
1. User öffnet Popup
   ↓
2. Füllt Formular aus (App Name, Client ID, etc.)
   ↓
3. Popup speichert in chrome.storage.sync
   ↓
4. Background Script lädt Konfiguration
   ↓
5. Bei Seiten-Besuch wird Activity gesetzt
```

## Technische Details

### Native Messaging Protokoll

**Format:**
```
[4 Bytes: Message Length][N Bytes: JSON Message]
```

**Beispiel Message:**
```json
{
  "type": "setActivity",
  "activity": {
    "clientId": "123456789",
    "activity": {
      "details": "Watching videos",
      "state": "Entertainment",
      "largeImageKey": "youtube"
    }
  }
}
```

### Discord RPC

**Bibliothek:** discord-rpc (npm)

**Connection:** IPC über Unix Socket / Named Pipe

**Authentifizierung:** Client ID (Discord Application)

### Storage

**Browser Extension:**
- `chrome.storage.sync`: App-Konfigurationen
  - Synchronisiert über Browser-Accounts
  - Max 100KB pro Item
  - Struktur: `{ apps: { [hostname]: config } }`

## Entwicklung

### Setup für Entwicklung

```bash
# Dependencies installieren
npm install

# Native Host installieren
npm run install-host

# Installation prüfen
npm run check

# Native Host testen
npm run test

# Extension in Browser laden
# Chrome: chrome://extensions/ -> "Entpackte Erweiterung laden"
# Firefox: about:debugging -> "Temporäres Add-on laden"

# Extension ID registrieren (Chrome/Edge)
npm run update-id
```

### Debugging

**Browser Extension:**
```
1. Chrome DevTools öffnen
2. Rechtsklick auf Extension Icon → "Popup untersuchen"
3. Oder: chrome://extensions/ → "Details" → "Hintergrundseite"
```

**Native Host:**
```bash
# Logs gehen nach stderr
npm run dev 2>&1 | tee native-host.log

# Oder Test-Modus:
npm run test
```

**Discord Connection:**
```bash
# Prüfe ob Discord läuft
ps aux | grep -i discord    # Linux/Mac
tasklist | findstr Discord  # Windows

# Prüfe Discord Settings
# Discord → Settings → Activity Status
# "Display current activity as status message" muss aktiviert sein
```

### Häufige Probleme

**1. "Native host not found"**
- Manifest nicht korrekt registriert
- Extension ID fehlt in Manifest
- Node.js nicht im PATH

**2. "Can't connect to Discord"**
- Discord Desktop App läuft nicht
- Discord als Admin gestartet (nicht empfohlen)
- Falscher Client ID

**3. "Activity not showing"**
- Activity Status in Discord deaktiviert
- Discord braucht einige Sekunden
- Application ID ungültig

## Erweiterungsmöglichkeiten

### Geplante Features

1. **Dynamische Details**
   - Seitentitel in Details einbinden
   - Custom Platzhalter: `{title}`, `{url}`, etc.

2. **Profile**
   - Verschiedene Konfigurations-Sets
   - Schnelles Umschalten zwischen Profilen

3. **Auto-Detection**
   - Vorschläge basierend auf besuchten Seiten
   - Community-Konfigurationen importieren

4. **Advanced Patterns**
   - Regex-basierte URL-Matching
   - Subdomain-spezifische Konfigurationen

5. **Buttons**
   - Discord RPC unterstützt bis zu 2 Buttons
   - Links zu Seiten oder Profilen

### Erweiterung entwickeln

**Neue Message-Types hinzufügen:**

1. In `native-host/index.js` neuen Handler:
```javascript
case 'newFeature':
  await handleNewFeature(message);
  break;
```

2. In `extension/background.js` Message senden:
```javascript
sendToNative({ type: 'newFeature', data: ... });
```

**Neue UI-Elemente:**

1. In `extension/popup.html` HTML hinzufügen
2. In `extension/popup.js` Event Listener registrieren
3. In `chrome.storage.sync` speichern

## API-Referenz

### Native Host Messages

**Von Extension an Native Host:**

```javascript
// Ping (Test)
{ type: 'ping' }

// Activity setzen
{
  type: 'setActivity',
  activity: {
    clientId: string,
    activity: {
      details: string,
      state: string,
      startTimestamp: number,
      largeImageKey: string,
      largeImageText: string,
      smallImageKey: string,
      smallImageText: string
    }
  }
}

// Activity löschen
{ type: 'clearActivity' }
```

**Von Native Host an Extension:**

```javascript
// Connected
{ type: 'connected', user: { username, id } }

// Pong
{ type: 'pong' }

// Activity gesetzt
{ type: 'activitySet', success: true }

// Activity gelöscht
{ type: 'activityCleared', success: true }

// Fehler
{ type: 'error', error: string }
```

### Storage Schema

```javascript
{
  apps: {
    'youtube.com': {
      name: 'YouTube',
      clientId: '1234567890',
      details: 'Watching videos',
      state: 'Entertainment',
      largeImageKey: 'youtube',
      largeImageText: 'YouTube',
      smallImageKey: 'playing',
      smallImageText: 'Active',
      enabled: true
    },
    // ... weitere Apps
  }
}
```

## Lizenz

MIT License

## Credits

- **discord-rpc**: Discord RPC Client Library
- **Discord Developer Docs**: Rich Presence Dokumentation
- **Chrome/Firefox Docs**: Native Messaging API

## Support & Contribution

Issues und Pull Requests sind willkommen!

### Contribution Guidelines

1. Fork das Repository
2. Erstelle einen Feature Branch
3. Commite deine Änderungen
4. Push zum Branch
5. Erstelle einen Pull Request

### Code Style

- JavaScript: Standard JS Style
- 2 Spaces Indentation
- Aussagekräftige Variablennamen
- Kommentare auf Englisch im Code
- Dokumentation auf Deutsch + Englisch
