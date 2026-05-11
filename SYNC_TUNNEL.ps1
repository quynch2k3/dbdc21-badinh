# Script to automatically sync current tunnel URL (Localhost.run) to the codebase
$ErrorActionPreference = "Stop"

Write-Host "================================================"
Write-Host " SYNCING TUNNEL URL TO CODEBASE"
Write-Host "================================================"

try {
    # 1. Get current tunnel info from tunnel.log (Localhost.run)
    if (-not (Test-Path "tunnel.log")) {
        throw "Could not find tunnel.log. Please start Option 1 in START_ALL.bat first!"
    }

    $logContent = Get-Content "tunnel.log" -Raw
    # Regex to find the https URL from Localhost.run output
    $urlRegex = "https://[a-z0-9\-]+\.(lhr\.life|lhr\.rocks)"
    if ($logContent -match $urlRegex) {
        $publicUrl = $matches[0]
    } else {
        throw "Could not find active tunnel URL in tunnel.log. Wait 5s and try again."
    }

    Write-Host "Found active tunnel: $publicUrl"

    # 2. Update ALL .js files in pb_public
    $jsFiles = Get-ChildItem -Path "pb_public" -Filter "*.js" -Recurse
    foreach ($file in $jsFiles) {
        $content = Get-Content $file.FullName -Raw
        # Match any previous tunnel URL (localhost.run or ngrok legacy)
        $replaceRegex = "https?://[a-z0-9\-]+\.(lhr\.life|lhr\.rocks|ngrok-free\.dev|ngrok\.io)"
        if ($content -match $replaceRegex) {
            $newContent = $content -replace $replaceRegex, $publicUrl
            Set-Content -Path $file.FullName -Value $newContent -NoNewline
            Write-Host "Updated URL in: $($file.Name)"
        }
    }

    # 3. Update HTML versions
    Write-Host "Updating HTML versions to force cache refresh..."
    if (Test-Path ".\UPDATE_HTML_VERSIONS.bat") {
        & ".\UPDATE_HTML_VERSIONS.bat"
    }

    Write-Host "================================================"
    Write-Host " SUCCESS: Tunnel URL synced."
    Write-Host "================================================"
} catch {
    Write-Host " [ERROR] $($_.Exception.Message)"
}

pause
