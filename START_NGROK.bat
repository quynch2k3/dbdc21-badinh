@echo off
echo === KIEM TRA NGROK VERSION ===
ngrok version
echo.
echo === THU CHAY VOI YAML ===
ngrok start --config=ngrok.yml pocketbase
if %errorlevel% neq 0 (
    echo.
    echo === YAML THAT BAI - THU LENH TRUC TIEP ===
    ngrok http 8090 --host-header="localhost:8090" --request-header-add="ngrok-skip-browser-warning:true" --response-header-add="Access-Control-Allow-Origin:*" --response-header-add="Access-Control-Allow-Methods:GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD" --response-header-add="Access-Control-Allow-Headers:*"
)
if %errorlevel% neq 0 (
    echo.
    echo === CA 2 CACH DEU THAT BAI - CHAY DON GIAN ===
    echo Ban dang dung ngrok version cu. Hay tai ngrok moi tai https://ngrok.com/download
    ngrok http 8090
)
pause
