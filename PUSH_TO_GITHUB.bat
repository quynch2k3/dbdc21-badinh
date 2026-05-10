@echo off
setlocal enabledelayedexpansion

:: --- CONFIGURATION ---
set REPO_URL=https://github.com/quynch2k3/dbdc21-badinh.git
set BRANCH=main
set USER_NAME=quynch2k3
set USER_EMAIL=quynch2k3@example.com

:: --- UI SETUP ---
title GITHUB SYNC TOOL (IDENTITY FIX) - %USER_NAME%
color 0B

echo ======================================================
echo    DONG BO GITHUB - KHAC PHUC LOI DANH TINH
echo ======================================================
echo.

:: 1. Clean and Re-init
echo [1/4] Dang lam sach kho luu tru cu...
if exist .git (
    rd /s /q .git
)
git init

:: 2. Setup Identity (MUST be after init)
echo [2/4] Dang thiet lap danh tinh: %USER_NAME%...
git config user.name "%USER_NAME%"
git config user.email "%USER_EMAIL%"
:: Optional: Set global as fallback
git config --global user.name "%USER_NAME%"
git config --global user.email "%USER_EMAIL%"

:: 3. Prepare Files
echo [3/4] Dang chuan bi du lieu...
git remote add origin %REPO_URL%
git add .
git rm --cached client_secret_*.json >nul 2>&1

set TIMESTAMP=%date% %time%
echo [!] Dang tao ban ghi Commit...
git commit -m "Identity Clean Sync: !TIMESTAMP!"
git branch -M %BRANCH%

:: 4. Push
echo [4/4] Dang tai len Github...
git push -u origin %BRANCH% --force

if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo  [ THANH CONG ] Da dong bo len Github hoan tat!
    echo ======================================================
) else (
    echo.
    echo ======================================================
    echo  [ LOI ] Van khong the day len. 
    echo  Hay chac chan ban da dang nhap GitHub tren may tinh.
    echo ======================================================
)

echo.
pause
