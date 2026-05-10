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

    # 2. Update ALL .js files in pb_public
    $jsFiles = Get-ChildItem -Path "pb_public" -Filter "*.js" -Recurse
    foreach ($file in $jsFiles) {
        $content = Get-Content $file.FullName -Raw
        # Regex to find any ngrok-free.dev or ngrok.io URL
        $regex = "https?://[a-z0-9\-]+\.(ngrok-free\.dev|ngrok\.io)"
        if ($content -match $regex) {
            $newContent = $content -replace $regex, $publicUrl
            Set-Content -Path $file.FullName -Value $newContent -NoNewline
            Write-Host "Updated URL in: $($file.Name)"
        }
    }

    # 3. Update HTML versions
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
