@echo off
setlocal enabledelayedexpansion
title TDP21 - HE THONG QUAN LY DBDC SO 21
color 0B

:START_ALL_TOP
:MAIN_MENU
cls
echo ====================================================
echo     HE THONG DBDC SO 21 - PHUONG DIEN BIEN
echo ====================================================
echo.
echo [1] Khoi dong He Thong (Build + Run + Tunnel)
echo [2] Cap nhat Link ngrok + Day len GitHub
echo [3] Thoat
echo.
set /p CHOICE="Chon chuc nang (1-3): "

if "%CHOICE%"=="1" goto BUILD_AND_RUN
if "%CHOICE%"=="2" goto SYNC_AND_PUSH
if "%CHOICE%"=="3" exit /b
echo Invalid choice, try again.
pause
goto :MAIN_MENU

REM =====================================================
:BUILD_AND_RUN
echo.
echo ====================================================
echo  BUOC 1: KIEM TRA MOI TRUONG GOLANG...
echo ====================================================
go version
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Go! Cai dat tai: https://go.dev/dl/
    pause
    exit /b
)

echo.
echo BUOC 2: TAI THU VIEN PHU THUOC...
go mod tidy

echo.
echo BUOC 3: XOA BUILD CACHE VA BIEN DICH MOI...
go clean -cache
echo [OK] Da xoa build cache.

echo.
echo BUOC 4: BIEN DICH -> _new_server.exe (Ten khac de tranh xung dot)...
if exist _new_server.exe del /f /q _new_server.exe >nul 2>&1
go build -o _new_server.exe .
if %errorlevel% neq 0 (
    echo.
    echo [LOI] go build that bai!
    if exist _new_server.exe del /f /q _new_server.exe >nul 2>&1
    pause
    exit /b
)

echo [OK] Bien dich thanh cong!
echo.
echo BUOC 5: TAT SERVER CU VA CAP NHAT FILE...
powershell -NoProfile -Command "Stop-Process -Name 'tdp21-server' -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Remove-Item -Force 'tdp21-server.exe' -ErrorAction SilentlyContinue; Remove-Item -Force 'myapp.exe' -ErrorAction SilentlyContinue"
move /y _new_server.exe tdp21-server.exe
echo [OK] Da cap nhat tdp21-server.exe

echo.
if not exist tdp21-server.exe goto L_BUILD_FAIL

echo ====================================================
echo  [THANH CONG] San sang khoi dong he thong!
echo ====================================================
echo.

REM Khoi dong server o tien trinh moi
start "PocketBase Server - DBDC 21" tdp21-server.exe serve

REM Doi server khoi dong
timeout /t 3 /nobreak >nul

REM Mo trinh duyet
echo Dang mo trang chu...
start http://localhost:8090/index.html
echo Dang mo trang quan tri...
start http://localhost:8090/_/

echo.
echo ====================================================
echo  DANG KHOI CHAY NGROK TUNNEL (PORT 8090)...
echo  (Giu cua so nay mo de tunnel hoat dong)
echo ====================================================
echo.
echo Dang thu khoi dong ngrok...
ngrok http 8090 --host-header="localhost:8090" --request-header-add="ngrok-skip-browser-warning:true" --response-header-add="Access-Control-Allow-Origin:*"
if %errorlevel% neq 0 (
    echo [WARN] Lenh nang cao that bai. Dang dung ngrok co ban...
    ngrok http 8090
)

pause
exit /b


:SYNC_AND_PUSH
echo.
echo ====================================================
echo  STEP 1: SYNCING NGROK URL...
echo ====================================================
call powershell -ExecutionPolicy Bypass -File SYNC_NGROK_URL.ps1
if errorlevel 1 echo [WARNING] Sync failed, but continuing...
echo.
echo [OK] Sync process finished.
timeout /t 2 >nul
goto PUSH_GITHUB

:PUSH_GITHUB
echo.
echo ====================================================
echo  STEP 2: PUSHING TO GITHUB...
echo ====================================================
set REPO_URL=https://github.com/quynch2k3/dbdc21-badinh.git
set BRANCH=main
set USER_NAME=quynch2k3
set USER_EMAIL=quynch2k3@example.com

if not exist .git git init
if not exist .git git remote add origin %REPO_URL%

git config user.name "%USER_NAME%"
git config user.email "%USER_EMAIL%"

echo.
echo [1/3] Adding files...
git add .
git rm --cached client_secret_*.json >nul 2>&1
git rm --cached pb_data >nul 2>&1
git rm --cached *.exe >nul 2>&1

echo [2/3] Creating commit...
git commit -m "Auto-sync-at-timestamp"

echo [3/3] Pushing to origin...
git push -u origin %BRANCH% --force

echo.
echo ====================================================
echo  PROCESS FINISHED. 
echo  If you see 'Everything up-to-date' or a success msg above, it worked.
echo ====================================================
echo.
echo Press any key to return to Menu...
pause
goto :MAIN_MENU

:MAIN_MENU_LOOP
cls
goto START_ALL_TOP

:L_BUILD_FAIL
echo [ERROR] Could not build executable!
pause
goto :MAIN_MENU
