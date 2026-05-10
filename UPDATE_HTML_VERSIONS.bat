@echo off
echo Updating pocketbase-adapter version to V1.53 in all HTML files...
powershell -Command "$files = Get-ChildItem -Path 'pb_public' -Filter '*.html'; foreach ($f in $files) { $c = [System.IO.File]::ReadAllText($f.FullName); $u = $c -replace 'pocketbase-adapter\\.js\\?v=[^\\\"]+', 'pocketbase-adapter.js?v=V1.60'; $u = $u -replace 'sw\\.js\\?v=[^\\\"]+', 'sw.js?v=V1.60'; [System.IO.File]::WriteAllText($f.FullName, $u); echo \"Updated: $($f.Name)\" }"
echo Done!
pause
