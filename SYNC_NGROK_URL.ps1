# Script to automatically sync current ngrok URL to the codebase
$ErrorActionPreference = "Stop"

Write-Host "================================================"
Write-Host " SYNCING NGROK URL TO CODEBASE"
Write-Host "================================================"

try {
    # 1. Get current tunnel info from ngrok API
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels"
    $publicUrl = $tunnels.tunnels[0].public_url

    if (-not $publicUrl) {
        throw "Could not find active ngrok tunnel. Please start ngrok first!"
    }

    Write-Host "Found active tunnel: $publicUrl"

    # 2. Update media.js
    $mediaPath = "pb_public/media.js"
    if (Test-Path $mediaPath) {
        $content = Get-Content $mediaPath -Raw
        $newContent = $content -replace "const NGROK_URL = 'https://[^']+';", "const NGROK_URL = '$publicUrl';"
        Set-Content -Path $mediaPath -Value $newContent -NoNewline
        Write-Host "Updated: $mediaPath"
    }

    # 3. Update pocketbase-adapter.js
    $adapterPath = "pb_public/pocketbase-adapter.js"
    if (Test-Path $adapterPath) {
        $content = Get-Content $adapterPath -Raw
        $newContent = $content -replace ": 'https://[^']+'\);", ": '$publicUrl');"
        Set-Content -Path $adapterPath -Value $newContent -NoNewline
        Write-Host "Updated: $adapterPath"
    }

    # 3. Update UPDATE_HTML_VERSIONS.bat (optional but good for forcing cache)
    # Actually, we should just run it
    Write-Host "Updating HTML versions to force cache refresh..."
    & ".\UPDATE_HTML_VERSIONS.bat"

    Write-Host "================================================"
    Write-Host " SUCCESS: URL synced. Now you can PUSH to GitHub."
    Write-Host "================================================"
} catch {
    Write-Host " [ERROR] $($_.Exception.Message)"
    Write-Host " Make sure START_ALL.bat (Option 1) is running in another window!"
}

pause
