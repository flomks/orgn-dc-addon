# Discord Rich Presence für Web-Apps

Zeige deine Lieblings-Web-Apps als Discord-Aktivität mit Rich Presence!

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 Was macht das?

Dieses Tool ermöglicht es dir, **Web-Anwendungen** (YouTube, Spotify Web, GitHub, etc.) als **Discord Rich Presence** anzuzeigen - genau wie bei Spielen!

**Beispiel in Discord:**
```
👤 DeinUsername
🎮 Spielt YouTube
📺 Watching videos
⏱️ seit 15 Minuten
```

## ✨ Features

- 🎮 **Deine persönliche Rich Presence** (nicht für Bots!)
- 🔒 **Opt-In System** - Nur Seiten die DU konfigurierst werden getrackt
- 🖥️ **Desktop-App mit GUI** - Live-Logs, Status-Anzeige, Test-Interface
- 🌐 **Browser Extension** - Automatische Erkennung konfigurierter Webseiten
- 🎨 **Custom Bilder & Details** - Upload Assets zu Discord
- 🔄 **Cross-Platform** - Windows, macOS, Linux
- 📊 **Live-Monitoring** - Siehe genau was passiert

## 🚀 Quick Start (5 Minuten)

### 1. Installation

```bash
npm install
```

### 2. Desktop-App starten

```bash
npm run app
```

Ein Fenster öffnet sich mit Dashboard, Logs und Test-Interface.

### 3. Discord Application erstellen

1. Gehe zu https://discord.com/developers/applications
2. Erstelle eine Application
3. Kopiere die **Application ID**
4. (Optional) Lade Bilder unter "Rich Presence → Art Assets" hoch

### 4. Teste es!

In der Desktop-App:
1. Gehe zum **"Test"** Tab
2. Trage deine Application ID ein
3. Fülle das Formular aus
4. Klicke **"Set Test Activity"**
5. Schaue in dein Discord-Profil! 🎉

## 📦 Komponenten

Dieses Projekt besteht aus drei Teilen:

### 1. Desktop-App (Electron) ⭐ Empfohlen

**Starten:**
```bash
npm run app
```

**Features:**
- ✅ Schöne GUI mit Dashboard, Logs, Test-Interface
- ✅ Live-Logs in Echtzeit
- ✅ Discord Status & Connection Monitor
- ✅ System Tray Integration
- ✅ Funktioniert standalone ODER mit Browser Extension

**Anleitung:** Siehe [DESKTOP-APP-GUIDE.md](DESKTOP-APP-GUIDE.md)

### 2. Browser Extension

**Laden:**
- **Chrome/Edge:** `chrome://extensions/` → "Entpackte Erweiterung laden" → `extension/` Ordner
- **Firefox:** `about:debugging` → "Temporäres Add-on laden" → `extension/manifest-firefox.json`

**Features:**
- ✅ Erkennt konfigurierte Webseiten automatisch
- ✅ Popup-UI zur Konfiguration
- ✅ Kommuniziert mit Desktop-App/Native Host

**Setup:** Siehe [docs/BROWSER-EXTENSION.md](docs/BROWSER-EXTENSION.md)

### 3. Native Host (Optional - CLI ohne GUI)

Unsichtbarer Hintergrund-Host ohne GUI. Nur wenn du keine Desktop-App willst.

## 🎮 Verwendung

### Mit Desktop-App (Empfohlen)

**Standalone Testing:**
```bash
npm run app
# Gehe zu "Test" Tab und teste Activities direkt
```

**Mit Browser Extension:**
```bash
# 1. Desktop-App starten
npm run app

# 2. Extension mit Desktop-App verbinden
npm run use-app

# 3. Browser neu starten

# 4. Webseite konfigurieren:
#    - Öffne YouTube (oder andere Seite)
#    - Extension-Icon klicken
#    - Formular ausfüllen
#    - Speichern!

# 5. Desktop-App zeigt alle Logs live an!
```

### Nur Browser Extension (ohne GUI)

```bash
# Native Host registrieren (CLI-Modus)
npm run install-host
npm run use-cli

# Extension ID hinzufügen (Chrome/Edge)
npm run update-id

# Browser neu starten - fertig!
```

## 🛠️ Verfügbare Commands

```bash
# Desktop-App
npm run app              # Desktop-App starten (GUI)
npm run use-app          # Extension mit Desktop-App verbinden

# Native Host (CLI - kein GUI)
npm run install-host     # Native Host registrieren
npm run use-cli          # Extension mit CLI-Host verbinden
npm run update-id        # Extension ID hinzufügen (Chrome/Edge)

# Tools & Debugging
npm run diagnose         # System-Check (empfohlen!)
npm run test             # Native Host manuell testen
npm run debug            # Debug-Modus mit Logs

# Build
npm run build:win        # Windows .exe erstellen
npm run build:mac        # macOS .app erstellen
npm run build:linux      # Linux Binary erstellen
```

## 📚 Dokumentation

| Datei | Beschreibung |
|-------|--------------|
| **[DESKTOP-APP-GUIDE.md](DESKTOP-APP-GUIDE.md)** | Desktop-App Anleitung (GUI) |
| **[FAQ.md](FAQ.md)** | Häufig gestellte Fragen |
| **[docs/ANLEITUNG-DE.md](docs/ANLEITUNG-DE.md)** | Ausführliche deutsche Anleitung |
| **[docs/DEBUGGING.md](docs/DEBUGGING.md)** | Fehlersuche & Problemlösung |
| **[docs/BROWSER-EXTENSION.md](docs/BROWSER-EXTENSION.md)** | Browser Extension Setup |
| **[PROJECT.md](PROJECT.md)** | Technische Dokumentation |

## 🐛 Troubleshooting

### Problem: Extension findet Native Host nicht

```bash
npm run diagnose
# Folge den Anweisungen
```

### Problem: Discord zeigt keine Activity

**Checkliste:**
- [ ] Discord Desktop App läuft (nicht Browser!)
- [ ] Aktivitätsstatus in Discord aktiviert
- [ ] Application ID korrekt
- [ ] Desktop-App/Native Host läuft

### Problem: VS Code öffnet sich

✅ **Gelöst mit Desktop-App!**
```bash
npm run use-app
npm run app
```

Siehe [FAQ.md](FAQ.md) für mehr Lösungen.

## 🎨 Beispiele

Siehe [examples/](examples/) Ordner für vorgefertigte Konfigurationen:
- YouTube, Spotify, Netflix
- GitHub, VS Code Web, Figma
- Google Docs, Notion
- ... und mehr!

## 🔒 Privacy

- ✅ Nur Seiten die du **explizit** konfigurierst werden erkannt
- ✅ Nur Hostname wird intern verwendet (z.B. `youtube.com`)
- ❌ Keine kompletten URLs
- ❌ Keine Seiteninhalte
- ❌ Keine Cookies oder Passwörter

## 🤝 Contributing

Contributions sind willkommen! Öffne Issues oder Pull Requests.

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE)

## 🙏 Credits

- **discord-rpc** - Discord RPC Client Library
- **Electron** - Desktop-App Framework

## 💡 Support

Bei Problemen:
1. Siehe [FAQ.md](FAQ.md)
2. Führe `npm run diagnose` aus
3. Öffne ein GitHub Issue

---

**Viel Spaß! 🎉** Zeige deinen Freunden was du gerade machst!
