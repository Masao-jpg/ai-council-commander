# PowerShell script to create desktop shortcut for AI Council Commander

$projectPath = $PSScriptRoot
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "AI Council Commander.lnk"
$batPath = Join-Path $projectPath "start-ai-council.bat"

# Create WScript Shell object
$WScriptShell = New-Object -ComObject WScript.Shell

# Create shortcut
$shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = $projectPath
$shortcut.IconLocation = "shell32.dll,14"  # Terminal icon
$shortcut.Description = "Launch AI Council Commander"
$shortcut.Save()

Write-Host "✓ Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "Location: $shortcutPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now double-click 'AI Council Commander' on your desktop to launch the app." -ForegroundColor Yellow

pause
