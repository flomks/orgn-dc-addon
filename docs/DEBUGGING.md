# Debugging Guide

## Problem: Visual Studio Code öffnet sich beim Start

Das ist normal! Der Native Host wird **automatisch vom Browser gestartet**, wenn die Extension eine Verbindung aufbaut.

### ⚠️ WICHTIG: Du musst den Native Host NICHT manuell starten!

Der Browser startet den Native Host automatisch, wenn:
- Die Extension eine Nachricht senden will
- Die Extension connectNative() aufruft
- Du eine Web-App öffnest, die konfiguriert ist

## Wie funktioniert das System?

```
1. Du öffnest YouTube im Browser
   ↓
2. Extension erkennt: "YouTube ist konfiguriert!"
   ↓
3. Extension ruft chrome.runtime.connectNative()
   ↓
4. Browser startet AUTOMATISCH: node native-host/index.js
   ↓
5. Native Host läuft im Hintergrund (unsichtbar)
   ↓
6. Extension sendet Activity-Daten
   ↓
7. Native Host setzt Discord Rich Presence
```

## Debugging-Schritte

### Schritt 1: Installation prüfen

```bash
npm run check
```

**Erwartete Ausgabe:**
```
✓ Native host script exists
✓ Chrome manifest exists
✓ discord-rpc package installed
```

Wenn ❌ erscheint:
```bash
npm run install-host
```

### Schritt 2: Extension ID registrieren

**NUR BEI CHROME/EDGE NÖTIG!**

```bash
npm run update-id
```

Gib deine Extension ID ein (von chrome://extensions/)

### Schritt 3: Browser komplett neu starten

**WICHTIG:** Alle Browser-Fenster schließen!

- Windows: Task-Manager öffnen, alle Chrome-Prozesse beenden
- Mac/Linux: `killall chrome` oder Browser-Fenster schließen

### Schritt 4: Extension testen

1. Browser öffnen
2. Gehe zu einer konfigurierten Seite (z.B. YouTube)
3. Öffne Browser DevTools (F12)
4. Gehe zu "Console" Tab
5. Schaue nach Fehlermeldungen

### Schritt 5: Extension Hintergrund-Logs prüfen

**Chrome:**
1. Gehe zu `chrome://extensions/`
2. Finde deine Extension
3. Klicke auf "Details"
4. Scrolle runter zu "Hintergrundseite untersuchen" oder "Service Worker"
5. Klicke drauf → DevTools öffnet sich
6. Schaue in die Console

**Du solltest sehen:**
```
[Background] Service worker started
[Background] Connecting to native host...
[Background] Received from native: {type: 'connected'}
[Background] Native host connected successfully
```

**Bei Fehler siehst du:**
```
[Background] Native host disconnected: Error: ...
```

### Schritt 6: Native Host manuell testen (Optional)

Wenn du den Native Host direkt testen willst:

```bash
npm run test
```

**Was passiert:**
- Startet Native Host manuell
- Sendet Test-Nachrichten
- Zeigt Logs in der Console
- Versucht Test-Activity zu setzen

**Erwartete Ausgabe:**
```
[Native Host] Native host started
[Native Host] Connecting to Discord...
✓ Received from native host: { type: 'connected' }
✓ Discord RPC connected as: DeinUsername
```

## Häufige Fehler und Lösungen

### Fehler 1: "Specified native messaging host not found"

**Problem:** Native Host ist nicht registriert oder Extension ID fehlt

**Lösung:**
```bash
# Neu installieren
npm run install-host

# Extension ID hinzufügen (Chrome/Edge)
npm run update-id

# Browser komplett neu starten!
```

### Fehler 2: "Access denied" oder "Permission denied"

**Problem:** Native Host Script ist nicht ausführbar (Linux/Mac)

**Lösung:**
```bash
chmod +x native-host/index.js
```

### Fehler 3: "Cannot find module 'discord-rpc'"

**Problem:** Dependencies nicht installiert

**Lösung:**
```bash
npm install
```

### Fehler 4: "Discord RPC connection failed"

**Problem:** Discord Desktop App läuft nicht

**Checkliste:**
- [ ] Discord Desktop App läuft (nicht Browser-Version!)
- [ ] Discord ist nicht als Administrator gestartet
- [ ] Discord Aktivitätsstatus ist aktiviert
  - Discord → Einstellungen → Aktivitätsstatus
  - ✓ "Zeige aktuelles Spiel als Statusmeldung"

### Fehler 5: Extension zeigt "Verbindung erfolgreich" aber nichts passiert

**Problem:** Native Host startet, aber Application ID ist falsch

**Lösung:**
1. Prüfe ob Application ID korrekt ist (18-19 Zahlen)
2. Prüfe ob Application existiert auf discord.com/developers/applications
3. Schaue in Extension Background Logs (siehe Schritt 5 oben)

### Fehler 6: Visual Studio Code öffnet sich ständig

**Problem:** Windows versucht `.js` Dateien mit VS Code zu öffnen statt mit Node.js

**Das ist OK!** Der Browser ruft den Native Host mit `node` auf, nicht direkt die `.js` Datei.

**Wenn es trotzdem stört:**

Prüfe die Manifest-Datei:

**Windows:**
```
%LOCALAPPDATA%\discord-rpc-native-host\com.discord.richpresence.webapp.json
```

**Der "path" sollte sein:**
```json
{
  "path": "C:\\Pfad\\zum\\Projekt\\native-host\\index.js"
}
```

**NICHT:**
```json
{
  "path": "node C:\\Pfad\\..."  ← FALSCH
}
```

Der Browser ruft automatisch `node` auf mit dem Script-Pfad.

## Logs finden

### Extension Logs

**Chrome:**
- `chrome://extensions/` → Details → Service Worker → Console

**Firefox:**
- `about:debugging` → This Firefox → Extension → Inspect → Console

### Native Host Logs

Der Native Host schreibt Logs nach **stderr** (nicht stdout, da stdout für Messaging verwendet wird).

**Manuell testen:**
```bash
npm run test
```

**Oder im Task-Manager sehen:**
- Windows: Task-Manager → Details → Nach `node.exe` suchen
- Mac: Activity Monitor → Nach `node` suchen
- Linux: `ps aux | grep node`

## Test-Checkliste

Wenn nichts funktioniert, gehe diese Checkliste durch:

```
[ ] Node.js installiert (node --version)
[ ] npm install ausgeführt
[ ] npm run install-host ausgeführt
[ ] Extension in Browser geladen
[ ] Extension ID registriert (Chrome/Edge: npm run update-id)
[ ] Browser komplett neu gestartet (alle Fenster geschlossen)
[ ] Discord Desktop App läuft
[ ] Discord Aktivitätsstatus aktiviert
[ ] Discord Application erstellt (developers.discord.com)
[ ] Web-App in Extension konfiguriert
[ ] Application ID korrekt eingegeben
[ ] Auf konfigurierte Webseite navigiert
```

## Erfolgreicher Test

Wenn alles funktioniert, solltest du sehen:

**1. In Extension Background Console:**
```
[Background] Service worker started
[Background] Connecting to native host...
[Background] Received from native: {type: 'connected', user: {...}}
[Background] Setting activity: {details: '...', ...}
```

**2. Im Discord Profil:**
```
🎮 Spielt YouTube
📺 Watching videos
🕐 seit X Minuten
```

**3. Extension Badge:**
- Grüner Punkt (●) auf dem Extension-Icon

## Erweiterte Debugging-Optionen

### Native Host mit Debug-Output starten

Erstelle `native-host/debug.js`:

```javascript
// Wrapper zum Debuggen
const { spawn } = require('child_process');
const path = require('path');

const host = spawn('node', [path.join(__dirname, 'index.js')]);

host.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString('hex'));
});

host.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

host.on('close', (code) => {
  console.log('Exited with code:', code);
});

// Forward stdin
process.stdin.pipe(host.stdin);
```

Dann in der Manifest-Datei `debug.js` statt `index.js` verwenden.

### Messaging-Protokoll debuggen

Füge in `background.js` hinzu:

```javascript
// Nach nativePort.postMessage(message)
console.log('[Background] Sent bytes:', JSON.stringify(message).length);
console.log('[Background] Sent hex:', Buffer.from(JSON.stringify(message)).toString('hex'));
```

## Support

Wenn nichts funktioniert:

1. Führe aus: `npm run check`
2. Mache Screenshots von:
   - Extension Background Console
   - Browser Console (F12)
   - Task Manager (node.exe Prozesse)
3. Kopiere Fehlermeldungen
4. Teile Node.js Version (`node --version`)
5. Teile Browser & Version
6. Teile Betriebssystem

## Nützliche Befehle

```bash
# Installation prüfen
npm run check

# Native Host manuell testen
npm run test

# Native Host registrieren
npm run install-host

# Extension ID hinzufügen
npm run update-id

# Native Host deinstallieren
npm run uninstall-host

# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install
```
