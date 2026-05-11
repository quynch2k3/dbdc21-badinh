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

    $publicUrl = ""
    for ($i = 1; $i -le 10; $i++) {
        $logContent = Get-Content "tunnel.log" -Raw
        if ($logContent -match "https://[a-z0-9\-]+\.(lhr\.life|lhr\.rocks)") {
            $publicUrl = $matches[0]
            break
        }
        Write-Host "Waiting for tunnel URL ($i/10)..."
        Start-Sleep -Seconds 2
    }

    if ($publicUrl -eq "") {
        throw "Could not find active tunnel URL in tunnel.log after 20s. Please check if START_ALL.bat (Option 1) is still running."
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
