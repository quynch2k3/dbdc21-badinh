@echo off
title TOTAL WIPE - POCKETBASE REMOVAL
color 0c
echo ============================================================
echo   CANH BAO: THAO TAC NAY SE XOA HOAN TOAN POCKETBASE!
echo ============================================================
echo.
echo Cac thu muc va file se bi xoa:
echo - pocketbase.exe, tdp21_server.exe
echo - pb_data, pb_migrations
echo - pb_schema.json, pocketbase_log.txt, server_log.txt
echo - main.go, go.mod, go.sum
echo - reset_db.bat, start_system.bat, move_to_public.bat
echo - import_to_pb.js, clean_import.js, data_export.json
echo.
echo [TUY CHON] Ban co muon xoa luon thu muc pb_public (Source code frontend) khong?
set /p del_public="Xoa pb_public? (y/n): "

echo.
echo => Dang dung cac tien trinh dang chay...
taskkill /F /IM pocketbase.exe /T 2>nul
taskkill /F /IM tdp21_server.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo => Dang xoa file va thu muc...
del /f /q pocketbase.exe 2>nul
del /f /q tdp21_server.exe 2>nul
rmdir /s /q pb_data 2>nul
rmdir /s /q pb_migrations 2>nul
del /f /q pb_schema.json 2>nul
del /f /q pocketbase_log.txt 2>nul
del /f /q server_log.txt 2>nul
del /f /q main.go 2>nul
del /f /q go.mod 2>nul
del /f /q go.sum 2>nul
del /f /q reset_db.bat 2>nul
del /f /q start_system.bat 2>nul
del /f /q move_to_public.bat 2>nul
del /f /q import_to_pb.js 2>nul
del /f /q clean_import.js 2>nul
del /f /q data_export.json 2>nul
del /f /q "POCKETBASE)" 2>nul

if /i "%del_public%"=="y" (
    echo => Dang xoa pb_public...
    rmdir /s /q pb_public 2>nul
    echo OK: Da xoa pb_public.
)

echo.
echo ============================================================
echo   DA XOA TOAN BO HE THONG POCKETBASE!
echo ============================================================
pause
