// ==========================================================================
// P2P CLOUD MQTT CONFIG & CONFIG STATE
// ==========================================================================
let currentScreen = 'lobby';
let mqttClient = null;
let roomId = '';
let isHost = false; // Display Mode = Host, Controller Mode = Client

// Centralized state (maintained by Host, synced by Controller)
let timerState = {
    timeLeft: 300,
    totalTime: 300,
    isRunning: false,
    bg: "dark",
    digitColor: "white", // Default to white
    font: "sans"
};

let tickerInterval = null;

// DOM Elements
const screens = {
    lobby: document.getElementById('lobby-screen'),
    display: document.getElementById('display-screen'),
    controller: document.getElementById('controller-screen')
};

// ==========================================================================
// ROUTING & ROOM IDENTIFICATION
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
    // Check if URL contains '?room=xxxx'
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
        roomId = roomParam;
        isHost = false;
        showScreen('controller');
        initMqttConnection();
    } else {
        showScreen('lobby');
    }
});

function showScreen(screenName) {
    currentScreen = screenName;
    for (const key in screens) {
        if (key === screenName) {
            screens[key].classList.add('active');
        } else {
            screens[key].classList.remove('active');
        }
    }
}

// Bind Lobby Buttons
document.getElementById('btn-select-display').onclick = () => {
    isHost = true;
    roomId = 'taipower_' + Math.floor(Math.random() * 1000000).toString(16);
    showScreen('display');
    initDisplayScreen();
    initMqttConnection();
    startHostTicker();
};

document.getElementById('btn-select-controller').onclick = () => {
    isHost = false;
    // Ask for Room ID if entering manually
    const roomInput = prompt("請輸入大螢幕顯示的房間號碼 (Room ID)：");
    if (roomInput && roomInput.trim().length > 0) {
        roomId = roomInput.trim();
        showScreen('controller');
        initMqttConnection();
    } else {
        showScreen('lobby');
    }
};

document.getElementById('btn-disp-lobby').onclick = () => {
    cleanupConnections();
    window.location.search = ''; // refresh URL to lobby
};

document.getElementById('btn-ctrl-lobby').onclick = () => {
    cleanupConnections();
    window.location.search = ''; // refresh URL to lobby
};

function cleanupConnections() {
    if (mqttClient) {
        mqttClient.end();
        mqttClient = null;
    }
    if (tickerInterval) {
        clearInterval(tickerInterval);
        tickerInterval = null;
    }
}

// ==========================================================================
// MQTT P2P ENGINE (broker.emqx.io with secure Websockets)
// ==========================================================================
function initMqttConnection() {
    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
    
    const clientOptions = {
        connectTimeout: 5000,
        clientId: 'countdown_' + (isHost ? 'host_' : 'ctrl_') + Math.random().toString(16).substr(2, 6),
        keepalive: 60,
        clean: true
    };

    console.log(`🔌 Connecting to public MQTT broker: ${brokerUrl}`);
    
    mqttClient = mqtt.connect(brokerUrl, clientOptions);

    const stateTopic = `taipower/countdown/${roomId}/state`;
    const commandTopic = `taipower/countdown/${roomId}/command`;

    mqttClient.on('connect', () => {
        console.log('✓ MQTT connected successfully!');
        
        if (isHost) {
            // Host (Display) listens to incoming Controller commands
            mqttClient.subscribe(commandTopic, (err) => {
                if (!err) console.log(`✓ Subscribed to command channel: ${commandTopic}`);
            });
            // Initial state broadcast
            publishState();
        } else {
            // Controller listens to Host state broadcasts
            mqttClient.subscribe(stateTopic, (err) => {
                if (!err) console.log(`✓ Subscribed to state channel: ${stateTopic}`);
            });
            document.getElementById('ctrl-state-badge').textContent = '已連線，同步中';
            document.getElementById('ctrl-state-badge').style.color = 'var(--primary)';
        }
    });

    mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            
            if (isHost && topic === commandTopic) {
                // Host handles command from remote controller
                handleIncomingCommand(data);
            } 
            else if (!isHost && topic === stateTopic) {
                // Controller handles state broadcast from host
                if (data.type === 'state') {
                    timerState = data.state;
                    renderUI();
                } else if (data.type === 'finish') {
                    timerState = data.state;
                    renderUI();
                    window.playBeep();
                }
            }
        } catch (e) {
            console.error('Error parsing MQTT message:', e);
        }
    });

    mqttClient.on('error', (err) => {
        console.error('MQTT error:', err);
    });

    mqttClient.on('offline', () => {
        console.warn('MQTT offline, attempting reconnection...');
        if (!isHost) {
            document.getElementById('ctrl-state-badge').textContent = '斷線重連中...';
            document.getElementById('ctrl-state-badge').style.color = 'var(--secondary)';
        }
    });
}

function publishState(customType = 'state') {
    if (mqttClient && mqttClient.connected) {
        const stateTopic = `taipower/countdown/${roomId}/state`;
        const payload = JSON.stringify({ type: customType, state: timerState });
        mqttClient.publish(stateTopic, payload, { qos: 0, retain: false });
    }
}

function sendCommand(data) {
    if (mqttClient && mqttClient.connected) {
        const commandTopic = `taipower/countdown/${roomId}/command`;
        mqttClient.publish(commandTopic, JSON.stringify(data), { qos: 0 });
    } else {
        console.warn('Cannot send command. MQTT not connected.');
    }
}

// ==========================================================================
// HOST TICKER & COMMAND HANDLERS
// ==========================================================================
function startHostTicker() {
    if (tickerInterval) clearInterval(tickerInterval);
    
    tickerInterval = setInterval(() => {
        if (timerState.isRunning) {
            if (timerState.timeLeft > 0) {
                timerState.timeLeft--;
                publishState('state');
                renderUI();
            } else {
                timerState.isRunning = false;
                publishState('finish');
                renderUI();
                window.playBeep();
            }
        }
    }, 1000);
}

function handleIncomingCommand(data) {
    if (data.action) {
        switch (data.action) {
            case 'start':
                if (timerState.timeLeft > 0) timerState.isRunning = true;
                break;
            case 'pause':
                timerState.isRunning = false;
                break;
            case 'reset':
                timerState.isRunning = false;
                timerState.timeLeft = timerState.totalTime;
                break;
            case 'set':
                timerState.isRunning = false;
                timerState.totalTime = parseInt(data.value) || 300;
                timerState.timeLeft = timerState.totalTime;
                break;
            case 'adjust':
                const amount = parseInt(data.value) || 0;
                timerState.timeLeft = Math.max(0, timerState.timeLeft + amount);
                break;
        }
    } 
    else if (data.style) {
        if (data.style.bg) timerState.bg = data.style.bg;
        if (data.style.color) timerState.digitColor = data.style.color;
        if (data.style.font) timerState.font = data.style.font;
    }
    
    // Broadcast updated state immediately
    publishState('state');
    renderUI();
}

// ==========================================================================
// RENDER & UI SYNC
// ==========================================================================
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    
    if (h > 0) {
        return `${h}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
}

function renderUI() {
    const formatted = formatTime(timerState.timeLeft);

    // 1. DISPLAY SCREEN
    if (currentScreen === 'display') {
        const timerText = document.getElementById('display-timer-text');
        timerText.textContent = formatted;
        
        // Background style is strictly unified to black in CSS, but class keeps Display active
        document.getElementById('display-screen').className = `screen active screen-bg-dark`;

        // Font and dynamic Color mapping based on remaining time
        let colorClass = `digits-${timerState.digitColor}`;
        if (timerState.timeLeft <= 10) {
            colorClass = 'digits-flash-red';
        } else if (timerState.timeLeft <= 60) {
            colorClass = 'digits-red';
        }
        timerText.className = `timer-digits digits-${timerState.font} ${colorClass}`;

        // Bottom Bar play button
        document.getElementById('btn-disp-play').textContent = timerState.isRunning ? '⏸' : '▶';
    }

    // 2. CONTROLLER SCREEN
    if (currentScreen === 'controller') {
        const ctrlTimerText = document.getElementById('ctrl-timer-text');
        ctrlTimerText.textContent = formatted;
        
        // Sync preview color warning in real-time with Display
        let ctrlColorClass = `digits-${timerState.digitColor}`;
        if (timerState.timeLeft <= 10) {
            ctrlColorClass = 'digits-flash-red';
        } else if (timerState.timeLeft <= 60) {
            ctrlColorClass = 'digits-red';
        }
        ctrlTimerText.className = `timer-preview-val digits-${timerState.font} ${ctrlColorClass}`;

        // Status badge
        const badge = document.getElementById('ctrl-state-badge');
        if (timerState.isRunning) {
            badge.textContent = '倒數中';
            badge.className = 'badge active';
        } else {
            badge.textContent = '已暫停';
            badge.className = 'badge paused';
        }

        // Play/Pause button
        const playBtn = document.getElementById('btn-ctrl-play');
        if (timerState.isRunning) {
            playBtn.textContent = '暫停';
            playBtn.className = 'btn-primary running';
        } else {
            playBtn.textContent = '啟動';
            playBtn.className = 'btn-primary';
        }

        // Background styles sync is omitted as display is unified to black

        document.querySelectorAll('.color-dot').forEach(btn => {
            if (btn.getAttribute('data-color') === timerState.digitColor) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        document.querySelectorAll('.font-item').forEach(btn => {
            if (btn.getAttribute('data-font') === timerState.font) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

// ==========================================================================
// DISPLAY MODULE SPECIFIC
// ==========================================================================
function initDisplayScreen() {
    let connectionUrl = '';

    // Smart detect URL protocol
    if (window.location.protocol.startsWith('file')) {
        // Warning if opened via local file protocol
        connectionUrl = `https://onurisxiao-beep.github.io/countdown-web/?room=${roomId}`;
        document.getElementById('connection-url').innerHTML = `
            <div style="font-size:11px;color:#FF2A6D;margin-bottom:6px">⚠️ 您正以本地檔案開啟</div>
            <a href="${connectionUrl}" target="_blank" style="color:var(--primary);text-decoration:none">${connectionUrl}</a>
        `;
    } else {
        // Standard HTTP / HTTPS protocol (Local server or Github Pages)
        connectionUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        document.getElementById('connection-url').textContent = connectionUrl;
    }
    
    // Draw client-side QR Code onto canvas using QRCode library
    const canvas = document.getElementById('qr-canvas');
    QRCode.toCanvas(canvas, connectionUrl, { width: 160, margin: 1 }, function (error) {
        if (error) console.error('Failed to generate QR code on canvas:', error);
        else console.log('✓ QR code successfully generated!');
    });
}

// Panels toggling
document.getElementById('btn-disp-qr').onclick = () => {
    document.getElementById('connection-card').classList.toggle('active');
};

document.getElementById('btn-close-connection').onclick = () => {
    document.getElementById('connection-card').classList.remove('active');
};

// Fullscreen
document.getElementById('btn-disp-fullscreen').onclick = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => console.error(e));
    } else {
        document.exitFullscreen();
    }
};

// Bottom Bar local actions
document.getElementById('btn-disp-play').onclick = () => {
    handleIncomingCommand({ action: timerState.isRunning ? 'pause' : 'start' });
};

document.getElementById('btn-disp-reset').onclick = () => {
    handleIncomingCommand({ action: 'reset' });
};

// ==========================================================================
// CONTROLLER MODULE SPECIFIC
// ==========================================================================
// Init Pickers
const minSelect = document.getElementById('pick-min');
const secSelect = document.getElementById('pick-sec');

for (let i = 0; i <= 120; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i.toString().padStart(2, '0');
    if (i === 5) opt.selected = true;
    minSelect.appendChild(opt);
}

for (let i = 0; i < 60; i += 5) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i.toString().padStart(2, '0');
    secSelect.appendChild(opt);
}

// Bind Remote Control clicks
document.getElementById('btn-ctrl-play').onclick = () => {
    sendCommand({
        type: 'control',
        action: timerState.isRunning ? 'pause' : 'start'
    });
};

document.getElementById('btn-ctrl-reset').onclick = () => {
    sendCommand({ type: 'control', action: 'reset' });
};

document.getElementById('btn-ctrl-sub1').onclick = () => {
    sendCommand({ type: 'control', action: 'adjust', value: -60 });
};

document.getElementById('btn-ctrl-add1').onclick = () => {
    sendCommand({ type: 'control', action: 'adjust', value: 60 });
};

// Presets
document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.onclick = () => {
        const secs = btn.getAttribute('data-seconds');
        sendCommand({ type: 'control', action: 'set', value: secs });
    };
});

// Custom apply
document.getElementById('btn-apply-custom').onclick = () => {
    const m = parseInt(minSelect.value) || 0;
    const s = parseInt(secSelect.value) || 0;
    sendCommand({ type: 'control', action: 'set', value: m * 60 + s });
};

// Bind Style clicks
document.querySelectorAll('.bg-selector-grid .style-item').forEach(btn => {
    btn.onclick = () => {
        const bgVal = btn.getAttribute('data-bg');
        sendCommand({ type: 'style', bg: bgVal });
    };
});

document.querySelectorAll('.color-dot').forEach(btn => {
    btn.onclick = () => {
        const colorVal = btn.getAttribute('data-color');
        sendCommand({ type: 'style', color: colorVal });
    };
});

document.querySelectorAll('.font-item').forEach(btn => {
    btn.onclick = () => {
        const fontVal = btn.getAttribute('data-font');
        sendCommand({ type: 'style', font: fontVal });
    };
});
