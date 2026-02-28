# Troubleshooting Guide

## Problem: VS Code öffnet sich beim Klick auf die Extension

### Symptome
- Beim Klicken auf das Extension-Icon öffnet sich Visual Studio Code
- Dateien wie `index.js` oder `main.js` werden in VS Code geöffnet
- Die Extension funktioniert nicht wie erwartet

### Ursache
Auf Windows-Systemen ist das Problem, dass `.js` Dateien standardmäßig mit einem Editor (VS Code, Notepad++, etc.) verknüpft sind, anstatt mit Node.js ausgeführt zu werden.

Wenn das Native Host Manifest direkt auf eine `.js` Datei verweist, versucht Chrome/Edge diese zu "öffnen" anstatt sie auszuführen. Das Betriebssystem öffnet dann deinen Standard-Editor.

### Lösung

#### Option 1: Native Host neu installieren (Empfohlen)

Die Installation wurde repariert und verwendet jetzt automatisch `index.bat` auf Windows:

```bash
# Alte Installation entfernen
npm run uninstall-host

# Neu installieren (verwendet jetzt .bat auf Windows)
npm run install-host

# Extension ID hinzufügen (siehe unten)
npm run update-id
```

#### Option 2: Desktop-App verwenden (Einfacher!)

Anstatt den Native Host zu verwenden, starte einfach die Desktop-App:

```bash
npm run app
```

Die Desktop-App:
- ✅ Startet mit einem Klick
- ✅ Hat eine schöne GUI mit Live-Logs
- ✅ Funktioniert standalone OHNE Extension
- ✅ Kann AUCH mit der Extension kommunizieren
- ✅ Kein VS Code Problem!

**Empfehlung:** Verwende die Desktop-App für die beste Erfahrung!

#### Option 3: Extension ID manuell hinzufügen

Falls du die Extension bereits geladen hast:

1. Öffne `chrome://extensions/` in Chrome/Edge
2. Aktiviere "Entwicklermodus" (oben rechts)
3. Kopiere die **Extension ID** (lange Buchstaben/Zahlen-Kombination)
4. Führe aus:

```bash
npm run update-id
```

5. Gib die Extension ID ein wenn gefragt

### Technische Details

**Warum passiert das?**

Das Native Messaging Protocol von Chrome erwartet auf Windows eine ausführbare Datei (`.exe` oder `.bat`), die dann Node.js aufruft.

**Vorher (Falsch):**
```json
{
  "path": "C:\\...\\native-host\\index.js"
}
```
→ Windows versucht `index.js` zu öffnen → VS Code startet

**Nachher (Korrekt):**
```json
{
  "path": "C:\\...\\native-host\\index.bat"
}
```
→ `index.bat` führt `node index.js` aus → Funktioniert!

**Die `index.bat` Datei:**
```batch
@echo off
node "%~dp0index.js" %*
```

Diese Datei ruft einfach Node.js mit der `index.js` Datei auf.

---

## Problem: "Native host has exited" Fehler

### Ursache
Der Native Host kann nicht gestartet werden oder stürzt sofort ab.

### Lösung

1. **Prüfe die Installation:**
```bash
npm run check
```

2. **Teste den Native Host:**
```bash
npm run test
```

3. **Diagnose ausführen:**
```bash
npm run diagnose
```

4. **Logs prüfen:**
   - Chrome: `chrome://extensions/` → Details → "Hintergrundseite untersuchen"
   - Prüfe die Konsole auf Fehler

5. **Desktop-App verwenden:**
   Falls nichts hilft, verwende die Desktop-App stattdessen:
   ```bash
   npm run app
   ```

---

## Problem: Discord zeigt keine Activity

### Checkliste

- [ ] Ist Discord Desktop-App geöffnet? (Nicht Browser-Version!)
- [ ] Ist die Discord Application ID korrekt?
- [ ] Sind die Asset-Keys korrekt geschrieben?
- [ ] Ist die Webseite in der Extension konfiguriert?
- [ ] Ist die Extension aktiviert?
- [ ] Ist der Native Host/Desktop-App gestartet?

### Lösung

1. **Teste mit der Desktop-App:**
   ```bash
   npm run app
   ```
   
   Gehe zum "Test" Tab und teste manuell.

2. **Prüfe die Discord Application:**
   - Gehe zu https://discord.com/developers/applications
   - Öffne deine Application
   - Kopiere die Application ID (oben)
   - Stelle sicher, dass Asset-Namen exakt übereinstimmen (Groß-/Kleinschreibung!)

3. **Extension testen:**
   - Klicke auf Extension Icon
   - Klicke "Test Connection"
   - Prüfe Fehler in der Konsole

---

## Problem: Extension funktioniert nur manchmal

### Ursache
Der Native Host wird automatisch vom Browser gestartet und beendet. Manchmal dauert der Start zu lang oder er stürzt ab.

### Lösung

**Verwende die Desktop-App permanent im Hintergrund:**

```bash
npm run app
```

Die Desktop-App:
- Läuft permanent
- Zeigt Live-Logs
- Verbindet sich sofort
- Keine Start/Stop Verzögerung

Oder auf Windows/Linux Autostart:
- Siehe [DESKTOP-APP-GUIDE.md](DESKTOP-APP-GUIDE.md)

---

## Problem: Assets werden nicht angezeigt

### Ursache
Asset-Keys müssen exakt mit den Namen in Discord Developer Portal übereinstimmen.

### Lösung

1. Gehe zu https://discord.com/developers/applications
2. Öffne deine Application
3. Gehe zu "Rich Presence" → "Art Assets"
4. Kopiere die exakten Asset-Namen (Groß-/Kleinschreibung beachten!)
5. Verwende diese Namen in der Extension-Konfiguration

**Beispiel:**
- Discord Asset: `youtube_logo` (alles kleingeschrieben)
- Extension Config: `youtube_logo` (exakt gleich!)
- ❌ NICHT: `YouTube_Logo` oder `youtube-logo`

---

## Weitere Hilfe

Wenn du weitere Probleme hast:

1. **Logs sammeln:**
   ```bash
   npm run diagnose > logs.txt
   ```

2. **GitHub Issues:** Erstelle ein Issue mit den Logs

3. **Desktop-App Logs:** Die Desktop-App zeigt alle Fehler in Echtzeit im "Logs" Tab

4. **Discord Developer Docs:** https://discord.com/developers/docs/rich-presence/how-to
