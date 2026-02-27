## Desktop App mit GUI

Die Desktop-App bietet eine grafische Benutzeroberfläche für Discord Rich Presence.

### Features

- ✅ **Live-Logs** - Siehe alle Aktivitäten in Echtzeit
- ✅ **Discord Status** - Verbindungsstatus und User-Info
- ✅ **Activity Anzeige** - Aktuelle Rich Presence Activity
- ✅ **Test-Bereich** - Teste Activities direkt
- ✅ **System Tray** - Läuft im Hintergrund
- ✅ **Native Messaging** - Funktioniert mit Browser Extension

### Starten

```bash
npm run app
```

### Modi

**1. Desktop App (mit GUI)**
```bash
npm run app
```
Öffnet ein Fenster mit GUI, läuft im System Tray.

**2. Native Messaging Mode**
Wenn von Browser Extension gestartet:
- Läuft im Hintergrund
- GUI kann optional geöffnet werden (System Tray Icon)
- Logs werden in GUI angezeigt

### Build (Executable erstellen)

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Erstellt eine installierbare Anwendung im `dist/` Ordner.

### Verwendung

**Als Desktop App:**
1. Starte: `npm run app`
2. Fenster öffnet sich
3. Teste Verbindung im "Test" Tab
4. Minimiere - läuft im System Tray weiter

**Mit Browser Extension:**
1. Native Host registrieren: `npm run install-host`
2. **WICHTIG:** Manifest-Pfad muss auf Desktop-App zeigen!
3. Browser Extension nutzen wie gewohnt
4. Desktop App zeigt alle Logs an (wenn geöffnet)

### Manifest anpassen

Die Desktop-App kann als Native Host verwendet werden. Dazu muss in der Manifest-Datei der Pfad angepasst werden:

**Windows:**
`%LOCALAPPDATA%\discord-rpc-native-host\com.discord.richpresence.webapp.json`

**Ändere:**
```json
{
  "path": "C:/Pfad/zum/Projekt/desktop-app/main.js"
}
```

**ODER:** Nutze die gebaute .exe:
```json
{
  "path": "C:/Pfad/zur/Discord Rich Presence.exe"
}
```

### System Tray

- **Linksklick:** Fenster zeigen/verstecken
- **Rechtsklick:** Kontextmenü
  - Show Window
  - Clear Activity
  - Quit

### Shortcuts

- **ESC:** Fenster minimieren (zu Tray)
- **Strg+R:** Reload (Development)
- **Strg+Shift+I:** DevTools (Development)
