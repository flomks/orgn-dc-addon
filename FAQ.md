# Häufig gestellte Fragen (FAQ)

## Installation & Setup

### Q: Warum öffnet sich Visual Studio Code, wenn ich auf die Extension klicke?

**A:** Das war ein Bug in älteren Versionen! **Die Installation wurde repariert.**

**Problem:** Auf Windows verwies das Native Host Manifest auf `index.js` statt `index.bat`. Windows versuchte dann die `.js` Datei mit deinem Standard-Editor (VS Code) zu öffnen, anstatt sie auszuführen.

**Lösung:**
```bash
# Alte Installation entfernen
npm run uninstall-host

# Neu installieren (jetzt mit .bat Wrapper auf Windows)
npm run install-host

# Extension ID registrieren
npm run update-id
```

**Alternativ: Desktop-App verwenden (Einfacher!)**
```bash
npm run app
```

Die Desktop-App umgeht dieses Problem komplett und bietet eine schöne GUI!

**Wichtig:** Du musst den Native Host **NICHT manuell starten**!

Der Browser startet ihn **automatisch** im Hintergrund, wenn:
- Du eine konfigurierte Webseite öffnest
- Die Extension eine Verbindung aufbauen will

**Was du tun musst:**
1. `npm run install-host` - Einmalig, registriert den Native Host
2. Extension im Browser laden
3. `npm run update-id` - Extension ID registrieren
4. **Fertig!** Der Rest passiert automatisch

**Was du NICHT tun musst:**
- ❌ `npm run dev` oder `npm run start-host` aufrufen
- ❌ `node native-host/index.js` manuell starten
- ❌ Ein separates Terminal-Fenster offen halten

Siehe auch: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

### Q: Wie kann ich testen, ob es funktioniert?

**A:** Drei Methoden:

**Methode 1: Diagnose-Tool (Empfohlen)**
```bash
npm run diagnose
```
Zeigt alle Checks und mögliche Probleme.

**Methode 2: Manueller Test**
```bash
npm run test
```
Startet Native Host manuell und sendet Test-Activity.

**Methode 3: Im Browser testen**
1. Discord Desktop App starten
2. YouTube öffnen (oder andere Seite)
3. Extension-Icon klicken
4. Konfigurieren und speichern
5. Nach 5-10 Sekunden in Discord-Profil schauen

---

### Q: Extension zeigt "Verbindung erfolgreich", aber Discord zeigt nichts?

**A:** Mehrere mögliche Ursachen:

**1. Discord Desktop App läuft nicht**
- ✓ Starte Discord Desktop (nicht Browser-Version!)
- ✓ Discord darf NICHT als Administrator laufen

**2. Aktivitätsstatus ist deaktiviert**
- Discord öffnen
- Einstellungen → Aktivitätsstatus
- ✓ "Zeige aktuelles Spiel als Statusmeldung" aktivieren

**3. Application ID ist falsch**
- Prüfe ob die ID 18-19 Ziffern hat
- Prüfe ob die Application existiert (discord.com/developers/applications)

**4. Native Host läuft nicht**
- Öffne Extension Background Console (chrome://extensions/ → Details → Service Worker)
- Schaue nach Fehlermeldungen
- Führe `npm run diagnose` aus

**5. Web-App ist nicht konfiguriert**
- Extension-Icon klicken
- Prüfe ob die aktuelle Seite in der Liste ist
- Prüfe ob "Aktiviert" angehakt ist

---

### Q: Wo finde ich Logs / Fehlermeldungen?

**A:** Zwei Orte:

**Extension Logs:**
1. Öffne `chrome://extensions/` (oder `edge://extensions/`)
2. Finde deine Extension
3. Klicke auf "Details"
4. Klicke auf "Service Worker" (bei "Hintergrundseite untersuchen")
5. DevTools öffnen sich → Console Tab

**Native Host Logs:**
- Der Native Host läuft im Hintergrund
- Logs sind nicht direkt sichtbar
- Für Debugging: `npm run test` (startet manuell mit Logs)

---

## Funktionalität

### Q: Ist das meine persönliche Rich Presence oder die eines Bots?

**A:** Das ist **DEINE persönliche Rich Presence**!

- ✓ Wird in **deinem** Discord-Profil angezeigt
- ✓ Deine Freunde sehen, was du machst
- ✓ Wie bei Spielen (z.B. "Spielt League of Legends")
- ❌ **NICHT** für Discord-Bots

**Beispiel in Discord:**
```
👤 DeinUsername
🎮 Spielt YouTube
📺 Watching videos
⏱️ seit 15 Minuten
```

---

### Q: Werden alle Webseiten automatisch getrackt?

**A:** **NEIN!** Nur Seiten die du **explizit konfigurierst**.

**Standardverhalten:**
- Du öffnest YouTube → **Nichts passiert**
- Du öffnest GitHub → **Nichts passiert**
- Du öffnest irgendeine Seite → **Nichts passiert**

**Du musst aktiv hinzufügen:**
1. Webseite öffnen
2. Extension-Icon klicken
3. Formular ausfüllen
4. "Seite hinzufügen" klicken
5. **Nur dann** wird diese Seite erkannt

**Privacy:** Nur Seiten die du konfigurierst werden überhaupt erkannt.

---

### Q: Kann ich einzelne Seiten temporär deaktivieren?

**A:** Ja! Zwei Methoden:

**Methode 1: Temporär deaktivieren**
1. Extension-Icon klicken
2. Scrolle zu "Konfigurierte Apps"
3. Checkbox "Aktiviert" ausschalten
4. Konfiguration bleibt gespeichert

**Methode 2: Komplett löschen**
1. Extension-Icon klicken
2. Scrolle zu "Konfigurierte Apps"
3. "Löschen" Button klicken

---

### Q: Wie funktionieren die Bilder?

**A:** Drei Möglichkeiten:

**Option 1: Discord Assets (Empfohlen)**
1. Gehe zu discord.com/developers/applications
2. Wähle deine Application
3. Rich Presence → Art Assets
4. Lade Bild hoch (PNG/JPG, min. 512x512px)
5. Gib dem Bild einen Namen: z.B. `youtube_logo`
6. In Extension: "Large Image Key" = `youtube_logo`

**Option 2: Default verwenden**
- Setze "Large Image Key" = `default`
- Discord zeigt Standard-Bild

**Option 3: Externes Bild (Experimentell)**
- Manche URLs funktionieren direkt
- Nicht zuverlässig
- **Nicht empfohlen**

---

### Q: Muss ich für jede Webseite eine eigene Discord Application erstellen?

**A:** **NEIN!** Eine Application reicht für alle Webseiten.

**Eine Application für alles:**
```
Application: "My Web Apps"
Application ID: 123456789

→ YouTube: nutzt diese ID
→ Spotify: nutzt diese ID
→ GitHub: nutzt diese ID
→ Alle nutzen die gleiche ID!
```

**Nur die Assets unterscheiden sich:**
```
Application "My Web Apps":
  Asset: youtube_logo
  Asset: spotify_logo
  Asset: github_logo
  Asset: ...
```

**Optional: Mehrere Applications für Kategorien:**
```
Application 1: "Gaming" (für Twitch, Gaming-Sites)
Application 2: "Work" (für Docs, GitHub)
Application 3: "Entertainment" (für YouTube, Netflix)
```

---

### Q: Welche Daten werden an Discord gesendet?

**A:** Nur was du konfigurierst:

**Gesendet:**
- ✓ App Name (z.B. "YouTube")
- ✓ Details (z.B. "Watching videos")
- ✓ State (z.B. "Entertainment")
- ✓ Image Key (z.B. "youtube_logo")
- ✓ Timestamp (automatisch: aktuelle Zeit)

**NICHT gesendet:**
- ❌ Komplette URL
- ❌ Seiteninhalte
- ❌ Cookies
- ❌ Passwörter
- ❌ Formulardaten
- ❌ Persönliche Informationen

**Intern verwendet (bleibt lokal):**
- Hostname (z.B. `youtube.com`) für Matching
- Nur zum Erkennen der Seite

---

### Q: Funktioniert das mit Progressive Web Apps (PWAs)?

**A:** **Ja!** PWAs sind im Grunde Webseiten in einem App-Fenster.

Konfiguriere die PWA genauso wie eine normale Webseite:
1. Öffne die PWA
2. Extension-Icon klicken
3. Konfigurieren

**Beispiel:**
- Twitter als PWA installiert
- Öffne Twitter PWA
- Extension erkennt `twitter.com`
- Discord zeigt "Spielt Twitter"

---

## Technische Fragen

### Q: Warum brauche ich einen Native Host? Warum nicht nur Extension?

**A:** Browser-Sicherheit!

**Problem:**
- Browser-Extensions laufen in einer Sandbox
- Können nicht direkt mit lokalen Programmen kommunizieren
- Discord RPC benötigt IPC (Inter-Process Communication)

**Lösung:**
```
Browser Extension (Sandbox)
    ↓ Native Messaging (erlaubte Schnittstelle)
Native Host (Node.js, außerhalb Sandbox)
    ↓ IPC / Named Pipes
Discord Desktop App
```

**Alternative wäre:**
- Chrome Extension + Chromium-Native-Code = Viel komplexer
- WebSocket-Server + Desktop-App = Zusätzliche Software
- Native Messaging = Standardmethode, von Browser unterstützt

---

### Q: Kann ich den Native Host auch manuell starten für Debugging?

**A:** Ja, aber nur für Tests!

```bash
npm run test
```

**Das macht das Test-Script:**
1. Startet Native Host manuell
2. Sendet Test-Nachrichten
3. Zeigt Logs in Console
4. Beendet sich nach Tests

**Normaler Betrieb:**
- Browser startet/stoppt Native Host automatisch
- Keine manuelle Interaktion nötig

---

### Q: Unterstützt das System mehrere Browser gleichzeitig?

**A:** Ja! Aber Einschränkungen:

**Mehrere Browser:**
- ✓ Chrome + Edge gleichzeitig: Ja
- ✓ Chrome + Firefox gleichzeitig: Ja
- ✓ Alle gleichzeitig: Ja

**ABER:**
- Nur **ein** Browser kann gleichzeitig Rich Presence setzen
- Der letzte gewinnt
- Discord zeigt immer nur eine Activity

**Empfehlung:**
- Konfiguriere nur den Browser, den du hauptsächlich nutzt
- Oder: Deaktiviere die Extension in anderen Browsern

---

### Q: Synchronisieren sich die Konfigurationen über Geräte?

**A:** Ja, automatisch!

**Browser-Sync (Chrome/Edge):**
- Wenn du in Chrome eingeloggt bist
- Konfigurationen werden über Google-Account synchronisiert
- Auf allen Geräten verfügbar

**Firefox-Sync:**
- Wenn Firefox-Account verbunden
- Synchronisiert über Firefox-Sync

**ABER:**
- Native Host muss auf **jedem Gerät** installiert werden
- `npm run install-host` auf jedem PC ausführen

---

### Q: Funktioniert das im Inkognito-/Privat-Modus?

**A:** Nur wenn du es erlaubst:

**Chrome/Edge:**
1. Gehe zu `chrome://extensions/`
2. Finde die Extension
3. "Details" klicken
4. Scrolle zu "Im Inkognitomodus zulassen"
5. Aktiviere die Option

**Firefox:**
- Extensions funktionieren standardmäßig nicht in privaten Fenstern
- Kann in Einstellungen aktiviert werden

**Privacy-Überlegung:**
- Im Inkognito-Modus willst du vielleicht nicht getrackt werden
- Überlege, ob du die Extension dort wirklich aktivieren willst

---

### Q: Kann ich eigene Features hinzufügen?

**A:** Ja! Das Projekt ist Open Source.

**Architektur:**
```
extension/
  background.js    - Native Messaging Logic
  popup.js         - UI Logic
  content.js       - Seiten-Erkennung

native-host/
  index.js         - Discord RPC Logic

scripts/
  *.js             - Installation & Tools
```

**Beispiele für Erweiterungen:**
- Dynamische Details (Seitentitel einbinden)
- Buttons in Rich Presence (Discord unterstützt bis zu 2 Buttons)
- URL-Pattern Matching (Regex)
- Auto-Detection (automatisches Erkennen neuer Seiten)
- Profile-System (schnelles Umschalten)

Siehe `PROJECT.md` für technische Details.

---

## Problembehebung

### Q: "Specified native messaging host not found"

**A:** Native Host ist nicht richtig registriert.

**Lösung:**
```bash
# 1. Neu installieren
npm run install-host

# 2. Extension ID hinzufügen (Chrome/Edge)
npm run update-id

# 3. Browser KOMPLETT neu starten
# Windows: Task-Manager → Alle Chrome-Prozesse beenden
# Mac/Linux: Alle Browser-Fenster schließen

# 4. Prüfen
npm run diagnose
```

---

### Q: "Error: ENOENT: no such file or directory"

**A:** Pfad-Problem in der Manifest-Datei.

**Prüfen:**
```bash
npm run diagnose
```

Schaut nach "Manifest Path" Check.

**Manuell prüfen:**
- Windows: `%LOCALAPPDATA%\discord-rpc-native-host\com.discord.richpresence.webapp.json`
- Mac: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.discord.richpresence.webapp.json`
- Linux: `~/.config/google-chrome/NativeMessagingHosts/com.discord.richpresence.webapp.json`

Öffne die Datei, prüfe ob "path" korrekt ist.

---

### Q: "Cannot find module 'discord-rpc'"

**A:** Dependencies nicht installiert.

**Lösung:**
```bash
npm install
```

Wenn das nicht hilft:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

### Q: Extension funktioniert nach Browser-Update nicht mehr

**A:** Native Host muss neu registriert werden.

**Lösung:**
```bash
npm run install-host
```

Dann Browser neu starten.

---

## Weitere Fragen?

Siehe auch:
- `ANLEITUNG-DE.md` - Ausführliche deutsche Anleitung
- `DEBUGGING.md` - Detailliertes Debugging
- `PROJECT.md` - Technische Dokumentation

Oder führe aus:
```bash
npm run diagnose
```
