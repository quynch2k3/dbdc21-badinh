@echo off
echo ============================================
echo  DEPLOY: ULTIMATE CORS ^& RACE CONDITION FIX
echo ============================================
cd /d "%~dp0"
echo.
echo [1/4] Updating all HTML files to Adapter V1.53...
powershell -Command "$files = Get-ChildItem -Path 'pb_public' -Filter '*.html'; foreach ($f in $files) { $c = [System.IO.File]::ReadAllText($f.FullName); $u = $c -replace 'pocketbase-adapter\\.js\\?v=[^\\\"]+', 'pocketbase-adapter.js?v=V1.53'; [System.IO.File]::WriteAllText($f.FullName, $u); echo \"Updated: $($f.Name)\" }"

echo.
echo [2/4] Adding changed files to Git...
git add pb_public/sw.js pb_public/pocketbase-adapter.js pb_public/admin.js pb_public/cms.js pb_public/admin.html pb_public/index.html
git add pb_public/*.html

echo.
echo [3/4] Committing...
git commit -m "fix(cors): synchronous PB init V1.53 + race condition fixes in HTML/JS"

echo.
echo [4/4] Pushing to GitHub...
git push

echo.
echo ============================================
echo  XONG! Bay gio hay lam theo cac buoc sau:
echo.
echo  1. TAT cua so ngrok hien tai.
echo  2. CHAY lai START_ALL.bat (Chon [1])
echo     - No se dung ngrok.yml voi CORS header.
echo  3. DOI ~30 giay roi XOA CACHE trinh duyet
echo     - (Ctrl+Shift+Delete)
echo  4. TAI LAI (Reload) trang web.
echo ============================================
pause
