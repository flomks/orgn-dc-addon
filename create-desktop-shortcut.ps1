# Discord Rich Presence - Desktop Shortcut Creator
# Erstellt eine Desktop-Verknüpfung für die Electron App

Write-Host "Discord Rich Presence - Desktop Verknuepfung erstellen" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Get current directory
$AppDir = $PSScriptRoot
$StartScript = Join-Path $AppDir "start-app.bat"
$IconPath = Join-Path $AppDir "extension\icons\icon128.png"

# Check if start script exists
if (-not (Test-Path $StartScript)) {
    Write-Host "[ERROR] start-app.bat nicht gefunden!" -ForegroundColor Red
    Write-Host "Bitte stelle sicher, dass du im richtigen Verzeichnis bist." -ForegroundColor Red
    Read-Host "Druecke Enter zum Beenden"
    exit 1
}

# Get Desktop path
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Discord Rich Presence.lnk"

# Create shortcut
Write-Host "Erstelle Verknuepfung auf dem Desktop..." -ForegroundColor Yellow

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $StartScript
$Shortcut.WorkingDirectory = $AppDir
$Shortcut.Description = "Discord Rich Presence Desktop App"
$Shortcut.IconLocation = "shell32.dll,14"  # Standard app icon
$Shortcut.Save()

Write-Host ""
Write-Host "[SUCCESS] Desktop-Verknuepfung erfolgreich erstellt!" -ForegroundColor Green
Write-Host "Speicherort: $ShortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "Du kannst die App jetzt ueber die Desktop-Verknuepfung starten!" -ForegroundColor Cyan
Write-Host ""

Read-Host "Druecke Enter zum Beenden"
