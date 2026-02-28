# ORGN Discord Bridge - Desktop Shortcut Creator
# Creates a desktop shortcut for the Electron app

Write-Host "ORGN Discord Bridge - Create Desktop Shortcut" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Get current directory
$AppDir = $PSScriptRoot
$StartScript = Join-Path $AppDir "start-app.bat"
$IconPath = Join-Path $AppDir "extension\icons\icon128.png"

# Check if start script exists
if (-not (Test-Path $StartScript)) {
    Write-Host "[ERROR] start-app.bat not found!" -ForegroundColor Red
    Write-Host "Please make sure you are in the correct directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Get Desktop path
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "ORGN Discord Bridge.lnk"

# Create shortcut
Write-Host "Creating shortcut on desktop..." -ForegroundColor Yellow

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $StartScript
$Shortcut.WorkingDirectory = $AppDir
$Shortcut.Description = "ORGN Discord Bridge - Discord Rich Presence for Web Apps"
$Shortcut.IconLocation = "shell32.dll,14"  # Standard app icon
$Shortcut.Save()

Write-Host ""
Write-Host "[SUCCESS] Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "Location: $ShortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "You can now start the app via the desktop shortcut!" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to exit"
