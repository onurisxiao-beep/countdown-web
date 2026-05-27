const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const port = 3000;

// Host static frontend files under the root folder directly
app.use(express.static(__dirname));

// Detect Local Wi-Fi IPv4 address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal) {
                const ip = alias.address;
                if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
                    return ip;
                }
            }
        }
    }
    return '127.0.0.1';
}

const localIp = getLocalIpAddress();

app.listen(port, () => {
    console.clear();
    console.log("================================================================");
    console.log("    💎 倒數計時器 網頁版 伺服器啟動成功 💎");
    console.log("================================================================");
    console.log("");
    console.log(`  ✓ 本機顯示器網址：http://localhost:${port}`);
    console.log(`  ✓ 手機遙控端網址：http://${localIp}:${port}`);
    console.log("");
    console.log("  請將您的手機與本機電腦連線至【同一個 Wi-Fi 網路】以進行遙控。");
    console.log("  在大螢幕網頁點選「顯示器模式」後，即可用手機掃碼配對！");
    console.log("");
    console.log("  - 製作：一個人類、GEMINI CLI 與 Antigravity 聯合製作 -");
    console.log("================================================================");
});
