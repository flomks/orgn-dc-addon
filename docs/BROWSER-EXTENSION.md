# Browser Extension Setup

Detaillierte Anleitung für die Browser Extension.

## Installation

### Chrome / Edge

1. Öffne `chrome://extensions/` (oder `edge://extensions/`)
2. Aktiviere **"Entwicklermodus"** (Toggle oben rechts)
3. Klicke **"Entpackte Erweiterung laden"**
4. Wähle den `extension/` Ordner
5. Kopiere die **Extension ID** (lange Zeichenkette)

### Firefox

1. Öffne `about:debugging#/runtime/this-firefox`
2. Klicke **"Temporäres Add-on laden"**
3. Wähle `extension/manifest-firefox.json`
4. Fertig! (Firefox braucht keine ID-Registrierung)

## Mit Desktop-App verbinden

```bash
# Desktop-App Modus aktivieren
npm run use-app

# Browser komplett neu starten (alle Fenster schließen!)

# Desktop-App starten
npm run app
```

## Mit CLI-Host verbinden (ohne GUI)

```bash
# Native Host registrieren
npm run install-host

# CLI-Modus aktivieren
npm run use-cli

# Extension ID registrieren (nur Chrome/Edge)
npm run update-id

# Browser neu starten
```

## Web-App konfigurieren

1. Öffne eine Webseite (z.B. YouTube)
2. Klicke Extension-Icon in der Toolbar
3. Fülle das Formular aus:
   - **App Name**: z.B. "YouTube"
   - **Discord Application ID**: Deine ID von discord.com/developers
   - **Details**: z.B. "Watching videos"
   - **State**: z.B. "Entertainment"
   - **Large Image Key**: z.B. "youtube_logo" oder "default"
4. Klicke **"Seite hinzufügen/aktualisieren"**

## Troubleshooting

### "Specified native messaging host not found"

```bash
npm run diagnose
npm run use-app  # oder npm run use-cli
# Browser komplett neu starten
```

### Extension lädt nicht

- Prüfe Browser-Konsole (F12) auf Fehler
- Lade Extension neu (chrome://extensions/ → Reload)
- Prüfe ob `manifest.json` korrekt ist

### Verbindung bricht ab

- Desktop-App/Native Host muss laufen
- Prüfe Extension Background Logs:
  - `chrome://extensions/` → Details → Service Worker
  - Console Tab öffnen
- Schaue nach Fehlermeldungen

## Extension Logs prüfen

**Chrome/Edge:**
1. `chrome://extensions/`
2. Finde Extension → "Details"
3. "Service Worker" oder "Hintergrundseite untersuchen"
4. Console Tab

**Firefox:**
1. `about:debugging`
2. Extension → "Inspect"
3. Console Tab

**Erwartete Logs:**
```
[Background] Service worker started
[Background] Connecting to native host...
[Background] Received from native: {type: 'connected'}
[Background] Setting activity: ...
```

## Extension Permissions

Die Extension benötigt:
- **storage**: Konfigurationen speichern
- **tabs**: Aktuelle Seite erkennen
- **activeTab**: Tab-URL lesen
- **nativeMessaging**: Mit Desktop-App/Host kommunizieren
- **<all_urls>**: Alle Seiten überwachen (nur konfigurierte werden getrackt!)

## Deinstallation

1. Extension im Browser entfernen
2. Native Host deinstallieren:
   ```bash
   npm run uninstall-host
   ```
