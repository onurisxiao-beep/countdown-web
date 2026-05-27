#!/bin/bash
# 讓終端機支援 UTF-8 顯示
export LANG=en_US.UTF-8

clear
echo "===================================================="
echo "  💎 倒數計時器 網頁版 環境初始化 (Linux/ChromeOS) 💎"
echo "===================================================="
echo ""

# 檢查是否在專案目錄下，若否則切換
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "[1/2] 偵測到首次啟動，正在安裝 Node.js 依賴套件 (Express, WS, QRCode)..."
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ 錯誤：npm 安裝依賴失敗！請確認已安裝 Node.js 並且網路連線正常。"
        exit 1
    fi
    echo "✓ 依賴套件安裝完成！"
    echo ""
else
    echo "[1/2] 依賴套件已存在，跳過安裝步驟。"
    echo ""
fi

echo "[2/2] 正在啟動伺服器..."
echo ""
node server.js
