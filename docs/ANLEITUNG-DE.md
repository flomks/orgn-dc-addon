# Discord Rich Presence für Web-Apps - Deutsche Anleitung

## Was macht dieses Tool?

Dieses Tool ermöglicht es dir, Web-Anwendungen (die du als "Desktop-App" installiert hast oder einfach im Browser nutzt) als Discord-Aktivität anzuzeigen. So können deine Freunde sehen, welche Web-Apps du gerade benutzt.

### Beispiel

Wenn du YouTube im Browser schaust, kann Discord anzeigen:
```
🎮 Spielt YouTube
📺 Watching videos
⏱️ seit 15 Minuten
```

## Wie funktioniert es technisch?

```
┌─────────────────────┐
│  Web-App (Browser)  │
│   z.B. YouTube      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Browser-Extension  │ ← Du konfigurierst hier die Apps
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
│   Discord App       │ ← Zeigt deine Aktivität
└─────────────────────┘
```

## Installation

### 1. Voraussetzungen prüfen

Öffne eine Kommandozeile (CMD/PowerShell/Terminal) und prüfe:

```bash
node --version
# Sollte v14 oder höher sein
```

Falls Node.js nicht installiert ist: https://nodejs.org/ herunterladen

### 2. Projekt einrichten

```bash
# Im Projektordner:
npm install
npm run install-host
```

**Was passiert hier?**
- `npm install` lädt die benötigten Node.js-Pakete herunter
- `npm run install-host` registriert den Native Messaging Host bei deinem Browser

### 3. Extension im Browser laden

#### Google Chrome / Microsoft Edge:

1. Öffne `chrome://extensions/` in Chrome (oder `edge://extensions/` in Edge)
2. Schalte oben rechts **"Entwicklermodus"** ein
3. Klicke **"Entpackte Erweiterung laden"**
4. Wähle den `extension/` Ordner aus
5. **WICHTIG:** Kopiere die Extension ID (lange Buchstaben-/Zahlenkombination)

#### Mozilla Firefox:

1. Öffne `about:debugging#/runtime/this-firefox`
2. Klicke **"Temporäres Add-on laden"**
3. Wähle die Datei `extension/manifest-firefox.json`

### 4. Extension ID registrieren (nur Chrome/Edge)

```bash
node scripts/update-extension-id.js
```

Füge die kopierte Extension ID ein und drücke Enter.

### 5. Discord Application erstellen

1. Gehe zu: https://discord.com/developers/applications
2. Klicke **"New Application"**
3. Name eingeben (z.B. "Meine Web Apps")
4. **Application ID kopieren** (18-19 Zahlen)
5. Optional: Bilder hochladen unter "Rich Presence" → "Art Assets"

## Verwendung

### Erste App konfigurieren (Beispiel: YouTube)

1. **Discord Desktop App starten** (wichtig: Desktop, nicht Browser!)

2. **YouTube im Browser öffnen**

3. **Extension-Icon klicken** (in der Browser-Toolbar)

4. **Formular ausfüllen:**
   ```
   App Name: YouTube
   Discord Application ID: [Deine Application ID]
   Details: Videos schauen
   State: Entertainment
   Large Image Key: youtube
   Large Image Text: YouTube
   ```

5. **"Seite hinzufügen/aktualisieren" klicken**

6. **Prüfen:**
   - Schaue in dein Discord-Profil
   - Nach ca. 5-10 Sekunden sollte die Aktivität erscheinen

### Discord-Einstellungen

Stelle sicher, dass in Discord folgendes aktiviert ist:

1. Discord öffnen → Einstellungen (Zahnrad)
2. **Aktivitätsstatus**
3. Aktiviere: **"Zeige aktuelles Spiel als Statusmeldung"**

## Weitere Beispiele

### Spotify Web Player
```
App Name: Spotify
Application ID: [Deine ID]
Details: Musik hören
State: Entspannen
Large Image Key: spotify
Large Image Text: Spotify
```

### Google Docs
```
App Name: Google Docs
Application ID: [Deine ID]
Details: Dokument bearbeiten
State: Produktiv
Large Image Key: docs
Large Image Text: Google Docs
```

### Twitter / X
```
App Name: Twitter
Application ID: [Deine ID]
Details: Timeline durchschauen
State: Social Media
Large Image Key: twitter
Large Image Text: Twitter
```

### Twitch
```
App Name: Twitch
Application ID: [Deine ID]
Details: Stream schauen
State: Entertainment
Large Image Key: twitch
Large Image Text: Twitch
```

## Bilder hochladen (Optional aber empfohlen)

### Schritt 1: Bilder vorbereiten
- Format: PNG oder JPG
- Mindestgröße: 512x512 Pixel
- Empfohlen: 1024x1024 Pixel
- Transparenter Hintergrund (PNG) sieht am besten aus

### Schritt 2: In Discord hochladen
1. Gehe zu deiner Application: https://discord.com/developers/applications
2. Wähle deine Application
3. Klicke auf **"Rich Presence"** (links im Menü)
4. Scrolle zu **"Art Assets"**
5. Klicke **"Add Image(s)"**
6. Bild hochladen
7. **Wichtig:** Gib dem Bild einen Namen (z.B. `youtube`, `spotify`, etc.)
8. Dieser Name ist der **"Large Image Key"** in der Extension

### Wo finde ich Icons?

- **Kostenlose Icons:** https://icons8.com/, https://flaticon.com/
- **Offizielle Logos:** Meist auf der Website der jeweiligen App
- **Eigene erstellen:** Mit GIMP, Photoshop, oder online mit Canva

## Troubleshooting

### Problem: "Native host not found"

**Lösung:**
```bash
# Native Host neu installieren
npm run install-host

# Browser komplett neu starten (alle Fenster schließen)
```

### Problem: "Can't connect to Discord"

**Prüfe:**
1. Discord Desktop App läuft (nicht Browser-Version!)
2. Discord ist nicht als Administrator gestartet (wenn ja, beende und normal starten)
3. Discord Aktivitätsstatus ist aktiviert (siehe oben)

### Problem: Activity wird nicht angezeigt

**Checkliste:**
- [ ] Discord Desktop App läuft
- [ ] Aktivitätsstatus in Discord aktiviert
- [ ] Website ist korrekt konfiguriert
- [ ] Extension ist aktiv (grüner Punkt im Extension-Icon)
- [ ] Warte 10-15 Sekunden nach dem Laden der Seite

### Problem: Bild wird nicht angezeigt

**Mögliche Ursachen:**
1. Asset-Name stimmt nicht genau (Groß-/Kleinschreibung beachten!)
2. Bild wurde noch nicht in Discord Application hochgeladen
3. Discord braucht einige Minuten, um neue Assets zu verarbeiten

**Schnelle Lösung:** Verwende `default` als Image Key

### Problem: Extension funktioniert nach Browser-Update nicht mehr

```bash
# Native Host neu installieren
npm run install-host

# Extension im Browser neu laden
```

## Tipps & Tricks

### 1. URL-Muster verstehen

Die Extension erkennt Apps anhand der **Domain**. Beispiele:

- `youtube.com` → Funktioniert für alle YouTube-Seiten
- `docs.google.com` → Funktioniert nur für Google Docs
- `google.com` → Funktioniert für ALLE Google-Dienste

### 2. Mehrere Discord Applications

Du kannst verschiedene Applications für verschiedene App-Kategorien erstellen:

- **Gaming Apps** (Application ID 1): Steam, Epic Games, etc.
- **Productivity Apps** (Application ID 2): Google Docs, Notion, etc.
- **Entertainment** (Application ID 3): YouTube, Netflix, etc.

### 3. Dynamische Details

Die Felder "Details" und "State" können später erweitert werden, um:
- Aktuellen Seitentitel anzuzeigen
- Spezifische Informationen aus der Seite zu extrahieren

### 4. Privacy

**Welche Daten werden übertragen?**
- Nur die Daten, die du in der Konfiguration angibst
- Hostname der aktuellen Seite (z.B. `youtube.com`)
- Seitentitel (nur wenn du ihn verwendest)

**Keine Übertragung von:**
- Passwörtern
- Cookies
- Komplette URLs mit privaten Daten
- Seiteninhalte

## FAQ

**Q: Kann ich das auch für lokale Anwendungen nutzen?**
A: Nein, nur für Websites. Für lokale Apps gibt es andere Tools wie "Discord RPC Maker".

**Q: Funktioniert das mit Progressive Web Apps (PWAs)?**
A: Ja! PWAs sind im Prinzip auch nur Websites in einem speziellen Fenster.

**Q: Kostet das etwas?**
A: Nein, alles kostenlos. Discord Applications und RPC sind kostenlos.

**Q: Können andere sehen, welche Unterseite ich anschaue?**
A: Nur wenn du das in den Details konfigurierst. Standardmäßig wird nur der Hostname (z.B. `youtube.com`) verwendet.

**Q: Funktioniert das im Inkognito-Modus?**
A: Nur wenn du die Extension für Inkognito-Modus aktivierst (in den Extension-Einstellungen).

**Q: Kann ich das auf mehreren PCs nutzen?**
A: Ja, du musst es nur auf jedem PC installieren. Die Konfiguration wird automatisch über deinen Browser synchronisiert (wenn Browser-Sync aktiviert ist).

## Support

Bei Problemen:
1. Prüfe die Troubleshooting-Sektion
2. Schaue in die Browser-Konsole (F12)
3. Prüfe die Logs des Native Hosts
4. Öffne ein Issue auf GitHub

## Weiterführende Links

- Discord Developer Portal: https://discord.com/developers/docs/rich-presence/how-to
- Discord RPC Dokumentation: https://discord.com/developers/docs/topics/rpc
- Native Messaging Dokumentation: https://developer.chrome.com/docs/apps/nativeMessaging/
