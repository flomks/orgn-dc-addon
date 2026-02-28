# Desktop-App Modi - Verständnis und Verwendung

## 🤔 Die Verwirrung: Warum sagt die App "Extension cannot connect"?

Wenn du die Desktop-App mit `npm run app` startest und auf **"Check Extension Status"** klickst, siehst du:

```
ℹ️ Standalone Mode
Desktop app was started manually (npm run app)
Extension cannot connect in this mode
Extension starts the app automatically when needed
```

**Das ist verwirrend, aber technisch korrekt!** Lass mich erklären warum.

---

## 📋 Zwei verschiedene Modi

Die Desktop-App kann in **zwei komplett verschiedenen Modi** laufen:

### Modus 1: Standalone-Modus ⭐ (Einfach & Empfohlen)

**Wie starten:**
```bash
npm run app
```

**Was passiert:**
- ✅ App öffnet sich mit GUI
- ✅ Du kannst den "Test" Tab nutzen
- ✅ Du kannst manuell Activities setzen
- ✅ Du siehst alle Logs live
- ✅ System Tray Integration
- ❌ Extension kann NICHT kommunizieren

**Wofür nutzen:**
- Manuelles Testen von Discord Activities
- Entwicklung und Debugging
- Schnelles Ausprobieren ohne Extension
- Live-Logs anschauen

**Extension-Status:**
```
ℹ️ Standalone Mode
Extension cannot connect in this mode
```

**Das bedeutet:**
Die App wurde von DIR manuell gestartet (über Terminal). Sie läuft als normale Desktop-Anwendung und **wartet NICHT** auf Nachrichten von der Extension über stdin/stdout (Native Messaging Protocol).

---

### Modus 2: Native Messaging Modus 🔌 (Für Extension)

**Wie starten:**
```bash
# Du startest NICHTS manuell!
# Die Browser Extension startet die App automatisch wenn nötig
```

**Was passiert:**
- ✅ Extension erkennt konfigurierte Webseite
- ✅ Extension startet App **automatisch** im Hintergrund
- ✅ App läuft unsichtbar (kein Fenster)
- ✅ Extension kommuniziert über stdin/stdout
- ✅ App kann optional Fenster zeigen
- ✅ Extension kann kommunizieren!

**Wofür nutzen:**
- Automatische Web-App Erkennung
- Hintergrund-Betrieb
- Extension-gesteuerte Activities

**Extension-Status:**
```
✅ Extension Connected
Last ping: 2 seconds ago
Running in Native Messaging Mode
```

---

## 🎯 Wie nutze ich was?

### Szenario A: Ich will nur manuell testen (ohne Extension)

```bash
npm run app
```

1. App öffnet sich
2. Gehe zu **"Test" Tab**
3. Trage Discord Application ID ein
4. Fülle Formular aus (Details, State, etc.)
5. Klicke **"Set Test Activity"**
6. Öffne Discord → Siehe dein Profil!

**Status-Check zeigt:** "Standalone Mode" - Das ist **OKAY**! Die Extension brauchst du hier nicht.

---

### Szenario B: Ich will die Extension + App zusammen nutzen

**Option 1: Native Host registrieren (Empfohlen)**

```bash
# Schritt 1: Native Host installieren
npm run install-host

# Schritt 2: Extension laden (chrome://extensions/)

# Schritt 3: Extension ID registrieren
npm run update-id

# Schritt 4: Webseite öffnen (z.B. YouTube)
# Die Extension startet die App AUTOMATISCH im Hintergrund!
```

**Du musst NICHTS manuell starten!** Die Extension kümmert sich darum.

**Optional:** Wenn du die Logs sehen willst, kannst du parallel auch `npm run app` laufen lassen - beide Instanzen können koexistieren (aber kommunizieren nicht miteinander).

---

**Option 2: Desktop-App als Native Host (Fortgeschritten)**

Das ist komplizierter und wird in [DESKTOP-APP-GUIDE.md](../DESKTOP-APP-GUIDE.md) erklärt.

---

### Szenario C: Ich will die Extension nutzen UND die Logs sehen

**Problem:** Wenn die Extension die App im Native Messaging Mode startet, läuft sie unsichtbar.

**Lösung 1: Zwei Instanzen parallel**

```bash
# Terminal 1: Desktop App für Logs
npm run app

# Browser: Extension nutzen (startet zweite Instanz im Hintergrund)
```

- Standalone-App zeigt deine manuellen Tests
- Native Host (von Extension gestartet) läuft unsichtbar
- Beide funktionieren unabhängig

**Lösung 2: Debug-Logs in Browser Console**

```
Chrome: chrome://extensions/ 
→ Details 
→ "Hintergrundseite untersuchen"
```

Hier siehst du alle Extension-Logs.

---

## 🧠 Technische Erklärung

### Warum kann die Extension nicht mit Standalone-App kommunizieren?

**Native Messaging Protocol** erfordert:
- App liest von `stdin` (Standard Input)
- App schreibt zu `stdout` (Standard Output)
- Browser startet App als Kindprozess

**Standalone-Modus:**
```javascript
// main.js prüft:
process.stdin.isTTY === true  // Terminal ist verbunden
→ Standalone Mode
→ Extension kann nicht kommunizieren
```

**Native Messaging Modus:**
```javascript
process.stdin.isTTY === false  // stdin kommt von Browser
→ Native Messaging Mode
→ Extension kann kommunizieren
```

---

## 🆘 Häufige Fragen

### Q: Warum zeigt die App "Extension cannot connect" wenn ich sie manuell starte?

**A:** Weil du sie **manuell** gestartet hast. Die App wartet nicht auf Extension-Nachrichten. Das ist **normal und okay** für manuelle Tests!

### Q: Muss ich die App manuell starten damit die Extension funktioniert?

**A:** **NEIN!** Die Extension startet die App automatisch im Hintergrund. Du musst nichts tun.

### Q: Ich will die Extension nutzen UND die GUI sehen. Wie?

**A:** Das geht nicht direkt. Die App läuft entweder:
- Als GUI (Standalone) - keine Extension-Kommunikation
- Als Native Host (Unsichtbar) - mit Extension-Kommunikation

Du kannst aber **beide parallel** laufen lassen:
- GUI für deine Tests
- Native Host (unsichtbar) für Extension

### Q: Was ist besser: Standalone oder mit Extension?

**Kommt drauf an:**

| Zweck | Verwende |
|-------|----------|
| Schnell testen ohne Browser | **Standalone** (`npm run app`) |
| Automatische Web-App Erkennung | **Extension + Native Host** |
| Entwicklung & Debugging | **Standalone** |
| Produktiv-Nutzung | **Extension + Native Host** |

### Q: Kann ich beides gleichzeitig nutzen?

**A:** Ja! Du kannst `npm run app` für die GUI starten UND die Extension nutzen (die startet eine zweite Instanz). Beide arbeiten unabhängig.

---

## 🎯 Empfehlungen

### Für Einsteiger:
1. Starte mit **Standalone-Modus** (`npm run app`)
2. Teste manuell im "Test" Tab
3. Wenn das funktioniert, installiere Extension + Native Host

### Für tägliche Nutzung:
1. **Nur Extension + Native Host** installieren
2. Extension erkennt Webseiten automatisch
3. Alles läuft unsichtbar im Hintergrund

### Für Entwickler:
1. **Standalone-Modus** für Tests und Debugging
2. Live-Logs anschauen
3. Manuell verschiedene Activities testen

---

## ✅ Zusammenfassung

Die Nachricht **"Extension cannot connect in this mode"** bedeutet:

> "Du hast die App manuell gestartet. Sie läuft als normale Desktop-Anwendung. Wenn du willst, dass die Extension mit ihr kommuniziert, musst du stattdessen den Native Host installieren und die Extension die App automatisch starten lassen."

**Das ist KEIN Fehler!** Es ist nur eine Information über den aktuellen Modus.

---

Für weitere Details siehe:
- [DESKTOP-APP-GUIDE.md](../DESKTOP-APP-GUIDE.md) - Vollständige Desktop-App Anleitung
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Problemlösungen
- [README.md](../README.md) - Projekt-Übersicht
