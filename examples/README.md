# Example Configurations

Pre-made configurations for popular web apps.

## How to Use

1. Open `example-configs.json`
2. Find the app you want (e.g. `youtube.com`)
3. Open that website in your browser
4. Click the extension icon
5. Copy the values from the example into the form
6. Replace `YOUR_DISCORD_APPLICATION_ID` with your actual Application ID
7. Save

## Creating Custom Icons

### Where to Find Logos

- [Simple Icons](https://simpleicons.org/) - SVG brand logos
- Official brand/press pages of the website
- Website favicon scaled to 1024x1024

### Upload to Discord

1. Go to https://discord.com/developers/applications
2. Select your Application
3. "Rich Presence" > "Art Assets"
4. Click "Add Image(s)"
5. Upload your image and give it a name
6. Use that name as the Image Key in the extension

### Requirements

- Size: 1024x1024 pixels recommended (minimum 512x512)
- Format: PNG with transparent background, or JPG
- Max file size: 5 MB
- Naming: lowercase, no spaces, use underscores (e.g. `youtube_logo`)

## Example Configs

### Entertainment

```json
{
  "youtube.com": {
    "name": "YouTube",
    "details": "Watching videos",
    "state": "Entertainment",
    "largeImageKey": "youtube"
  },
  "twitch.tv": {
    "name": "Twitch",
    "details": "Watching streams",
    "state": "Entertainment",
    "largeImageKey": "twitch"
  },
  "netflix.com": {
    "name": "Netflix",
    "details": "Watching a show",
    "state": "Entertainment",
    "largeImageKey": "netflix"
  }
}
```

### Productivity

```json
{
  "github.com": {
    "name": "GitHub",
    "details": "Browsing repositories",
    "state": "Development",
    "largeImageKey": "github"
  },
  "notion.so": {
    "name": "Notion",
    "details": "Taking notes",
    "state": "Productive",
    "largeImageKey": "notion"
  },
  "figma.com": {
    "name": "Figma",
    "details": "Designing",
    "state": "Creative Work",
    "largeImageKey": "figma"
  }
}
```

## Tips

**Details** should describe what you are doing:
- Good: "Watching videos"
- Bad: "YouTube"

**State** should give context:
- Good: "Entertainment"
- Bad: "On YouTube"

**Image Keys** should be descriptive:
- Good: `youtube_logo`
- Bad: `img1`

Set `"enabled": false` to temporarily disable an app without deleting its configuration.
