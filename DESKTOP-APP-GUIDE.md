# Desktop App - Anleitung

## 🎉 Neue Desktop-App mit GUI!

Statt dass der Native Host unsichtbar im Hintergrund läuft (und VS Code sich öffnet), gibt es jetzt eine **schöne Desktop-Anwendung mit GUI**!

## ✨ Features

- ✅ **Echtes Fenster** - Keine Kommandozeile, kein VS Code
- ✅ **Live-Logs** - Siehe alle Aktivitäten in Echtzeit
- ✅ **Discord Status** - Verbindung und User-Info
- ✅ **Activity Monitor** - Was läuft gerade
- ✅ **Test-Bereich** - Teste Activities direkt in der App
- ✅ **System Tray** - Läuft minimiert im Hintergrund
- ✅ **Schönes UI** - Discord-Style Design

## 🚀 Starten

### Option 1: Als Desktop-App (empfohlen)

```bash
npm run app
```

**Was passiert:**
- Fenster öffnet sich
- Schöne GUI mit Tabs (Dashboard, Logs, Test)
- Läuft im System Tray weiter wenn du minimierst
- Keine Kommandozeile sichtbar

### Option 2: Mit Browser Extension

Die Desktop-App kann auch als Native Host für die Browser Extension arbeiten!

**Setup:**

1. **Native Host registrieren (aber mit Desktop-App):**

Editiere die Manifest-Datei manuell:

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

**Ändere den "path" zu:**
```json
{
  "name": "com.discord.richpresence.webapp",
  "description": "Discord Rich Presence for Web Apps",
  "path": "C:/DEIN/PFAD/ZUM/PROJEKT/desktop-app/main.js",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://DEINE_EXTENSION_ID/"
  ]
}
```

2. **Desktop-App starten:**
```bash
npm run app
```

3. **Browser Extension nutzen:**
- Extension erkennt Webseiten
- Sendet Activity an Desktop-App
- Desktop-App zeigt alles in Logs an
- Discord wird aktualisiert

## 📱 GUI Übersicht

### Dashboard Tab
- **Discord Connection:** Status und User-Info
- **Current Activity:** Was läuft gerade
- **Quick Actions:** Clear Activity, Test Connection

### Logs Tab
- **Live-Logs:** Alle Aktivitäten in Echtzeit
- **Auto-Scroll:** Automatisch zum neuesten Log scrollen
- **Clear Logs:** Logs löschen
- **Farbkodiert:** INFO (blau), SUCCESS (grün), WARN (orange), ERROR (rot)

### Test Tab
- **Test Form:** Manuell eine Activity setzen
- **Felder:**
  - Discord Application ID
  - Details (z.B. "Testing")
  - State (z.B. "Desktop App")
  - Large Image Key (z.B. "default")
  - Large Image Text
- **Actions:** Set Activity, Clear Activity

## 🎯 System Tray

Wenn du das Fenster schließt, läuft die App im System Tray weiter!

**Tray Icon (in der Taskleiste):**
- **Linksklick:** Fenster zeigen/verstecken
- **Rechtsklick:** Menü
  - Show Window
  - Clear Activity  
  - Quit

## 🔧 Verwendungsszenarien

### Szenario 1: Standalone Testing

```bash
npm run app
```

1. App öffnet sich
2. Gehe zu "Test" Tab
3. Trage Discord Application ID ein
4. Fülle Formular aus
5. Klicke "Set Test Activity"
6. Gehe zu Discord → Siehe dein Profil!

**Vorteil:** Kein Browser nötig, direktes Testen

### Szenario 2: Mit Browser Extension

```bash
# Terminal 1: Desktop App starten
npm run app

# Browser: Extension nutzen wie gewohnt
```

1. Desktop App läuft
2. Browser Extension erkennt Webseiten
3. Extension sendet an Desktop App
4. Desktop App zeigt Logs an
5. Desktop App setzt Discord Activity

**Vorteil:** Siehe alle Logs live, überwache was passiert

### Szenario 3: Im Hintergrund

```bash
npm run app
```

1. App starten
2. Minimieren (schließen mit X)
3. App läuft im System Tray weiter
4. Browser Extension funktioniert weiter
5. Bei Bedarf: Tray Icon klicken → Fenster öffnet sich

**Vorteil:** Läuft unsichtbar, keine Fenster offen

## 🏗️ Executable Bauen (Optional)

Wenn du eine richtige .exe/.app haben möchtest:

```bash
# Windows
npm run build:win

# macOS  
npm run build:mac

# Linux
npm run build:linux
```

**Ergebnis:** Im `dist/` Ordner findest du eine installierbare Anwendung!

Dann kannst du in der Manifest-Datei direkt auf die .exe verweisen:
```json
{
  "path": "C:/Programme/Discord Rich Presence/Discord Rich Presence.exe"
}
```

## 🆚 Vergleich: Old vs. New

### ❌ Vorher (Native Host)

```
npm run install-host
→ Registriert sich
→ Browser startet automatisch im Hintergrund
→ VS Code öffnet sich manchmal
→ Keine Logs sichtbar
→ Schwer zu debuggen
→ Unsichtbar was passiert
```

### ✅ Jetzt (Desktop App)

```
npm run app
→ Schönes Fenster öffnet sich
→ Live-Logs sichtbar
→ Connection Status sichtbar
→ Test-Möglichkeit direkt in der App
→ System Tray Icon
→ Einfach zu debuggen
→ Du siehst GENAU was passiert
```

## 🐛 Debugging

Die Desktop App zeigt ALLE Logs an!

**Du siehst genau:**
- Wann Extension verbindet
- Welche Messages gesendet werden
- Ob Discord verbindet
- Welche Fehler auftreten
- Wann Activity gesetzt wird

**Beispiel Log:**
```
[INFO] Discord Rich Presence Desktop App started
[INFO] Connecting to Discord with client ID: 123...
[SUCCESS] Discord RPC connected as: DeinName#1234
[INFO] Received from extension: setActivity
[INFO] Setting activity: {"details":"Watching videos",...}
[SUCCESS] Activity set successfully
```

## ❓ FAQ

### Q: Muss die Desktop App immer laufen?

**A:** Ja, wenn du die Browser Extension nutzen willst.

**Aber:** Sie kann minimiert im System Tray laufen!

### Q: Kann ich weiterhin den alten Native Host nutzen?

**A:** Ja! Beide Varianten funktionieren:

- **Old:** `native-host/index.js` (kein GUI)
- **New:** `desktop-app/main.js` (mit GUI)

In der Manifest-Datei kannst du wählen welchen Pfad du verwendest.

### Q: Öffnet sich jetzt immer ein Fenster?

**A:** Nein! Wenn die App schon läuft, wird kein neues Fenster geöffnet.

Du kannst sie auch minimieren → läuft im Tray weiter.

### Q: Was ist besser - Old oder New?

**Desktop App ist besser weil:**
- ✅ Du siehst was passiert (Logs)
- ✅ Einfacher zu debuggen
- ✅ Test-Möglichkeit eingebaut
- ✅ Schönes UI
- ✅ Kein VS Code öffnet sich

**Native Host ist besser wenn:**
- Du absolut nichts sehen willst (komplett unsichtbar)
- Du minimalen RAM-Verbrauch willst
- Du kein Electron installieren willst

## 🎨 Screenshots

### Dashboard
```
╔═══════════════════════════════════════════════╗
║ Discord Rich Presence              v1.0.0     ║
║                           ● Connected         ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  Discord Connection                           ║
║  Status: Verbunden                            ║
║  User: DeinName#1234                          ║
║                                               ║
║  Current Activity                             ║
║  Details: Watching videos                     ║
║  State: Entertainment                         ║
║  Large Image: youtube                         ║
║                                               ║
║  [Clear Activity]  [Test Connection]          ║
║                                               ║
╚═══════════════════════════════════════════════╝
```

### Logs
```
╔═══════════════════════════════════════════════╗
║ System Logs              [✓] Auto-scroll      ║
╠═══════════════════════════════════════════════╣
║ 12:34:56  INFO     App started                ║
║ 12:34:57  INFO     Connecting to Discord...   ║
║ 12:34:58  SUCCESS  Connected as DeinName      ║
║ 12:35:10  INFO     Setting activity...        ║
║ 12:35:11  SUCCESS  Activity set!              ║
╚═══════════════════════════════════════════════╝
```

## 🚀 Los geht's!

```bash
# Desktop App starten
npm run app

# Im Test-Tab eine Activity testen
# Oder: Browser Extension nutzen und Logs beobachten
```

**Viel Spaß mit der neuen GUI!** 🎉

Bei Fragen: Siehe `FAQ.md` oder `DEBUGGING.md`
