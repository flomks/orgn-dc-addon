# Discord Rich Presence - Desktop App starten

Es gibt mehrere Möglichkeiten, die Desktop App zu starten:

## Option 1: Start-Skripte (Empfohlen für Entwicklung)

### Windows
Doppelklick auf:
```
start-app.bat
```

### macOS / Linux
Im Terminal ausführen:
```bash
./start-app.sh
```

Oder doppelklicken (wenn als ausführbar markiert).

## Option 2: NPM Befehl

Im Terminal:
```bash
npm run app
```

## Option 3: Desktop-Verknüpfung erstellen (Windows)

1. Doppelklick auf `create-desktop-shortcut.bat`
2. Eine Verknüpfung wird auf deinem Desktop erstellt
3. Ab jetzt kannst du die App über die Desktop-Verknüpfung starten

**Hinweis:** Dies erstellt nur eine Verknüpfung zur Development-Version!

## Für Autostart: Installierbare Version erstellen

Die Autostart-Funktion funktioniert nur in der installierten Version:

### Windows (Installer erstellen)
```bash
npm run build:win
```
Ausgabe: `dist/Discord Rich Presence Setup.exe`

Nach der Installation:
- App erscheint im Startmenü
- Autostart kann in den Settings aktiviert werden
- App läuft als normale Windows-Anwendung

### macOS (DMG erstellen)
```bash
npm run build:mac
```
Ausgabe: `dist/Discord Rich Presence.dmg`

### Linux (AppImage/DEB erstellen)
```bash
npm run build:linux
```
Ausgabe: 
- `dist/Discord Rich Presence.AppImage`
- `dist/discord-rich-presence.deb`

## Unterschied: Development vs. Production

| Feature | Development (`start-app.bat`) | Production (nach Build) |
|---------|-------------------------------|-------------------------|
| Starten | Manuell über Skript/npm | Über Startmenü/Desktop |
| Autostart | ❌ Deaktiviert | ✅ Funktioniert |
| Updates | Sofort nach Code-Änderung | Muss neu gebaut werden |
| Performance | Langsamer (Dev-Tools aktiv) | Schneller (optimiert) |
| Verwendung | Entwicklung & Testing | Tägliche Nutzung |

## Troubleshooting

### "node_modules nicht gefunden"
```bash
npm install
```

### "Electron nicht installiert"
```bash
npm install electron --save-dev
```

### App startet nicht
1. Terminal öffnen
2. Ausführen: `npm run app`
3. Fehlermeldungen beachten

### Desktop-Verknüpfung funktioniert nicht (Windows)
Manuelle Verknüpfung erstellen:
1. Rechtsklick auf Desktop → Neu → Verknüpfung
2. Durchsuchen → `start-app.bat` auswählen
3. Name: "Discord Rich Presence"
4. Fertigstellen
