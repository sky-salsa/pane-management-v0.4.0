# DEV-ONLY: Run this instead of npm run tauri dev.
# The rebuild button calls process::exit(0), which exits the app.
# This loop catches the exit and relaunches automatically.
# Press Ctrl+C to stop the loop entirely.

Write-Host 'Starting dev loop - press Ctrl+C to stop' -ForegroundColor Cyan

while ($true) {
    npm run tauri dev
    $exitCode = $LASTEXITCODE
    Write-Host ''
    Write-Host "App exited (code $exitCode). Rebuilding in 1 second..." -ForegroundColor Yellow
    Write-Host 'Press Ctrl+C now to stop the loop.' -ForegroundColor DarkGray
    Start-Sleep 1
}
