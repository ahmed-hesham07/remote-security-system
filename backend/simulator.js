/*
 * Tiny ESP32 simulator for dashboard development without hardware.
 * Run:  node simulator.js
 * It connects to /ws as a "device" and POSTs random motion events.
 */

const WebSocket = require('ws');

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;
const HTTP_BASE = `http://${HOST}:${PORT}`;
const WS_URL    = `ws://${HOST}:${PORT}/ws?role=device`;

let doorLocked   = true;
let buzzerActive = false;

function log(...args) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[sim ${ts}]`, ...args);
}

function applyCommand(type) {
  if (type === 'lock')        { doorLocked = true;  log('🔒 servo -> LOCKED'); }
  else if (type === 'unlock') { doorLocked = false; buzzerActive = false; log('🔓 servo -> UNLOCKED, buzzer OFF'); }
  else if (type === 'silence'){ buzzerActive = false; log('🔕 buzzer OFF'); }
  else if (type === 'buzz')   { buzzerActive = true;  log('🔔 buzzer ON'); }
}

function connect() {
  const ws = new WebSocket(WS_URL);

  ws.on('open',    () => log('connected to', WS_URL));
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      log('<-', msg);
      applyCommand(msg.type);
    } catch (e) {
      log('bad message', e.message);
    }
  });
  ws.on('close', () => {
    log('disconnected, retrying in 3s');
    setTimeout(connect, 3000);
  });
  ws.on('error', (e) => log('error:', e.message));
}

async function postMotion() {
  try {
    const res = await fetch(`${HTTP_BASE}/api/motion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await res.json();
    buzzerActive = true;
    log('motion -> server, event #', data.event?.id);
  } catch (e) {
    log('motion post failed:', e.message);
  }
}

connect();

// Simulate a motion event every ~12-18 seconds.
setInterval(() => {
  const delay = 12000 + Math.random() * 6000;
  setTimeout(postMotion, delay);
}, 18000);

// Trigger one shortly after start so you can see it immediately.
setTimeout(postMotion, 4000);

log('Simulator running. Press Ctrl+C to stop.');
