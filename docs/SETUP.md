# Setup-Anleitung

Schritt-für-Schritt Anleitung zur Installation und Einrichtung.

## Voraussetzungen

- Node.js (v14 oder höher)
- npm
- Discord Desktop App
- Chrome, Edge, oder Firefox Browser

## Installation

### Schritt 1: Dependencies installieren

```bash
npm install
```

### Schritt 2: Native Host installieren

```bash
npm run install-host
```

Dies registriert den Native Messaging Host bei deinem Browser.

### Schritt 3: Browser Extension laden

#### Chrome/Edge:

1. Öffne `chrome://extensions/` (oder `edge://extensions/`)
2. Aktiviere **"Entwicklermodus"** (oben rechts)
3. Klicke **"Entpackte Erweiterung laden"**
4. Wähle den `extension/` Ordner aus diesem Projekt
5. **WICHTIG:** Kopiere die Extension ID (z.B. `abcdefghijklmnopqrstuvwxyz123456`)

#### Firefox:

1. Öffne `about:debugging#/runtime/this-firefox`
2. Klicke **"Temporäres Add-on laden"**
3. Wähle `extension/manifest-firefox.json` (NICHT die normale manifest.json!)
4. Die Extension ID ist fest: `{discord-richpresence-webapp@extension}`

### Schritt 4: Extension ID registrieren (nur Chrome/Edge)

Nach dem Laden der Extension in Chrome/Edge:

```bash
node scripts/update-extension-id.js
```

Gib die Extension ID ein, wenn du dazu aufgefordert wirst.

**Alternativ manuell:**

1. Finde die Manifest-Datei (siehe Ausgabe von `npm run install-host`)
2. Öffne sie in einem Texteditor
3. Füge deine Extension ID zu `allowed_origins` hinzu:
   ```json
   {
     "allowed_origins": [
       "chrome-extension://DEINE_EXTENSION_ID/"
     ]
   }
   ```

### Schritt 5: Discord Application erstellen

1. Gehe zu https://discord.com/developers/applications
2. Klicke **"New Application"**
3. Gib einen Namen ein (z.B. "My Web Apps")
4. Kopiere die **Application ID** (wichtig!)
5. (Optional) Unter **"Rich Presence"** → **"Art Assets"** kannst du Bilder hochladen
   - Gib jedem Bild einen Namen (z.B. `youtube_logo`)
   - Diese Namen verwendest du später in der Extension-Konfiguration

## Verwendung

### Web-App konfigurieren

1. Öffne eine Website, die du als Discord-Activity anzeigen möchtest
2. Klicke auf das Extension-Icon in der Browser-Toolbar
3. Fülle das Formular aus:
   - **App Name**: Name der Anwendung (z.B. "YouTube")
   - **Discord Application ID**: Die ID aus Schritt 5
   - **Details**: Optionaler Text (z.B. "Watching videos")
   - **State**: Optionaler Status (z.B. "Entertainment")
   - **Large Image Key**: Name eines hochgeladenen Assets (z.B. `youtube_logo`)
   - **Large Image Text**: Hover-Text für das Bild
   - **Small Image Key**: Name für kleines Bild (optional)
   - **Small Image Text**: Hover-Text für kleines Bild
4. Klicke **"Seite hinzufügen/aktualisieren"**

### Activity testen

1. Stelle sicher, dass Discord Desktop läuft
2. Gehe zu Discord → Einstellungen → Aktivitätsstatus
3. Aktiviere **"Zeige aktuelles Spiel als Statusmeldung"**
4. Öffne die konfigurierte Website
5. Dein Discord-Profil sollte nun die Activity anzeigen

### Troubleshooting

#### "Native host not found" Fehler

```bash
# Versuche die Installation erneut
npm run install-host

# Prüfe ob Node.js im PATH ist
node --version

# Starte Browser neu
```

#### Extension kann nicht mit Native Host kommunizieren

1. Prüfe, ob die Extension ID korrekt registriert ist
2. Schau in die Browser-Konsole (F12 → Console Tab)
3. Teste die Verbindung über den "Test Verbindung" Button im Popup

#### Discord zeigt keine Activity

1. Discord Desktop App muss laufen (nicht Browser-Version!)
2. Aktivitätsstatus muss in Discord aktiviert sein
3. Application ID muss korrekt sein
4. Warte bis zu 15 Sekunden nach dem Laden der Seite

#### Images werden nicht angezeigt

1. Stelle sicher, dass du Assets in der Discord Application hochgeladen hast
2. Verwende exakt die Namen der Assets (case-sensitive!)
3. Alternative: Verwende `default` als Large Image Key

## Beispiel-Konfiguration

### YouTube
```
App Name: YouTube
Application ID: 1234567890123456789
Details: Watching videos
State: Entertainment
Large Image Key: youtube
Large Image Text: YouTube
```

### Gmail
```
App Name: Gmail
Application ID: 1234567890123456789
Details: Checking emails
State: Productivity
Large Image Key: gmail
Large Image Text: Gmail
```

### Figma
```
App Name: Figma
Application ID: 1234567890123456789
Details: Designing
State: Creative Work
Large Image Key: figma
Large Image Text: Figma Design
```

## Deinstallation

```bash
npm run uninstall-host
```

Dann entferne die Extension im Browser:
- Chrome: `chrome://extensions/` → "Entfernen"
- Firefox: `about:addons` → Extension entfernen
