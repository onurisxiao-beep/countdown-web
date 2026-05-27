@echo off
title 倒數計時器網頁伺服器
cd /d "%~dp0"
echo ====================================================
echo   💎 倒數計時器 網頁版 環境初始化中... 💎
echo ====================================================
echo.

if not exist node_modules (
    echo [1/2] 偵測到首次啟動，正在為您安裝 Node.js 依賴套件 (Express, WS, QRCode)...
    call npm install
    if errorlevel 1 (
        echo.
        echo ❌ 錯誤：npm 安裝依賴失敗！請確認本機有安裝 Node.js 且網路連線正常。
        pause
        exit /b 1
    )
    echo ✓ 依賴套件安裝完成！
    echo.
) else (
    echo [1/2] 依賴套件已存在，跳過安裝步驟。
    echo.
)

echo [2/2] 正在啟動伺服器...
echo.
node server.js
if errorlevel 1 (
    echo.
    echo ❌ 錯誤：伺服器啟動失敗或異常中斷！
    pause
)
