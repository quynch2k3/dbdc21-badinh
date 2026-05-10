@echo off
echo DANG FIX LOI... 
powershell -Command "$c = Get-Content admin.js -Encoding Default; for($i=1800; $i -lt $c.Length; $i++){ if($c[$i] -match '<div'){ $c[$i] = '// ' + $c[$i] } }; $c | Set-Content admin.js -Encoding utf8"
echo DA FIX XONG. F5 LAI TRANG WEB.
pause
