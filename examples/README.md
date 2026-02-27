# Beispiel-Konfigurationen

Dieser Ordner enthält vorgefertigte Konfigurationen für beliebte Web-Apps.

## Verwendung

### Automatischer Import (Coming Soon)

Eine Import-Funktion wird in einer zukünftigen Version hinzugefügt.

### Manueller Import

1. Öffne `example-configs.json`
2. Suche die gewünschte App (z.B. `youtube.com`)
3. Kopiere die Konfiguration
4. Öffne die entsprechende Website im Browser
5. Klicke auf das Extension-Icon
6. Füge die Werte aus der Beispiel-Konfiguration ein
7. **WICHTIG:** Ersetze `YOUR_DISCORD_APPLICATION_ID` mit deiner echten Application ID

## Eigene Icons erstellen

### Wo finde ich Logos?

1. **Offizielle Quellen:**
   - Pressematerialien der jeweiligen Website
   - Brand Assets / Media Kits
   - Beispiel: https://about.youtube.com/press/brand-resources/

2. **Icon-Datenbanken:**
   - https://simpleicons.org/ (SVG-Logos von Marken)
   - https://icons8.com/ (kostenlose Icons)
   - https://flaticon.com/ (kostenlose Icons)

3. **Eigene Screenshots:**
   - Favicon der Website als Basis nehmen
   - Mit einem Bildbearbeitungsprogramm auf 1024x1024 skalieren
   - Transparenten Hintergrund hinzufügen

### Icon-Vorbereitung

```bash
# Empfohlene Größe
1024x1024 Pixel

# Format
PNG mit transparentem Hintergrund (empfohlen)
oder JPG

# Dateigröße
< 5 MB
```

### Icon hochladen

1. Discord Developer Portal: https://discord.com/developers/applications
2. Deine Application auswählen
3. "Rich Presence" → "Art Assets"
4. "Add Image(s)" klicken
5. Bild hochladen und benennen
6. Namen in Extension-Konfiguration verwenden

## Tipps für gute Konfigurationen

### Details & State

**Details:** Was machst du gerade?
```
Gut: "Watching videos"
Schlecht: "YouTube"
```

**State:** Kontext oder Kategorie
```
Gut: "Entertainment"
Schlecht: "On YouTube"
```

### Image Keys

- Verwende aussagekräftige Namen: `youtube`, nicht `img1`
- Kleinbuchstaben ohne Leerzeichen
- Verwende Unterstriche statt Bindestriche: `google_docs` statt `google-docs`

### Enabled Flag

Setze `"enabled": false` für Apps, die du vorübergehend nicht anzeigen möchtest, ohne die Konfiguration zu löschen.

## Häufige Use Cases

### Produktivität zeigen

```json
{
  "notion.so": {
    "name": "Notion",
    "details": "Planning my day",
    "state": "Productive",
    "largeImageKey": "notion"
  }
}
```

### Gaming/Entertainment

```json
{
  "twitch.tv": {
    "name": "Twitch",
    "details": "Watching [Streamer Name]",
    "state": "Entertainment",
    "largeImageKey": "twitch"
  }
}
```

### Professionelles Arbeiten

```json
{
  "figma.com": {
    "name": "Figma",
    "details": "Designing UI components",
    "state": "Client Project",
    "largeImageKey": "figma"
  }
}
```

## Mehrere Konfigurationen für eine Domain

Aktuell unterstützt die Extension nur eine Konfiguration pro Domain. Für verschiedene Kontexte (z.B. YouTube für Gaming-Videos vs. Tutorials) kannst du:

1. Die Konfiguration manuell über das Popup ändern
2. Verschiedene Discord Applications für verschiedene Zwecke erstellen
3. In einer zukünftigen Version: Profile-System nutzen (Coming Soon)

## Beitragen

Hast du eine gute Konfiguration für eine beliebte Web-App? 

Öffne einen Pull Request und füge sie zu `example-configs.json` hinzu!

Bitte stelle sicher:
- ✅ Der Name ist korrekt geschrieben
- ✅ Details und State sind aussagekräftig
- ✅ Image Keys verwenden sinnvolle Namen
- ✅ Die Konfiguration ist getestet
