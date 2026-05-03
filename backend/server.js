/*
 * Remote Security System — Backend
 * --------------------------------------------------------------
 * - REST API for the dashboard and ESP32 motion reports
 * - WebSocket /ws is the live channel:
 *     ?role=device     -> the ESP32 (receives lock/unlock/silence)
 *     ?role=dashboard  -> browser dashboards (receive motion + state)
 */

const express = require('express');
const http    = require('http');
const cors    = require('cors');
const path    = require('path');
const url     = require('url');
const { WebSocketServer } = require('ws');

const db = require('./db');

const PORT = parseInt(process.env.PORT, 10) || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// If deployed (e.g., Render), serve the built frontend from ../frontend/dist
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distDir));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// =====================================================================
// WebSocket fan-out
// =====================================================================
const devices    = new Set();
const dashboards = new Set();

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(set, msg) {
  const data = JSON.stringify(msg);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function pushState() {
  broadcast(dashboards, { type: 'state', state: db.getState() });
}

wss.on('connection', (ws, req) => {
  const { query } = url.parse(req.url, true);
  const role = (query.role || 'dashboard').toString();

  if (role === 'device') {
    devices.add(ws);
    console.log(`[WS] device connected (devices=${devices.size})`);
    db.logAudit('device_connected');
    // sync device with current state on connect
    const state = db.getState();
    send(ws, { type: state.door_locked ? 'lock' : 'unlock' });
    send(ws, { type: state.buzzer_active ? 'buzz' : 'silence' });

    ws.on('close', () => {
      devices.delete(ws);
      console.log(`[WS] device disconnected (devices=${devices.size})`);
      db.logAudit('device_disconnected');
    });
  } else {
    dashboards.add(ws);
    console.log(`[WS] dashboard connected (dashboards=${dashboards.size})`);

    send(ws, { type: 'hello', deviceOnline: devices.size > 0 });
    send(ws, { type: 'state', state: db.getState() });
    send(ws, { type: 'events', events: db.getRecentEvents(50) });
    send(ws, { type: 'stats', stats: db.getStats() });

    ws.on('close', () => {
      dashboards.delete(ws);
      console.log(`[WS] dashboard disconnected (dashboards=${dashboards.size})`);
    });
  }

  // Notify all dashboards of device-online change
  broadcast(dashboards, { type: 'device', online: devices.size > 0 });

  ws.on('error', (err) => console.error('[WS] error:', err.message));
});

// =====================================================================
// REST API
// =====================================================================

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, deviceOnline: devices.size > 0 });
});

// ESP32 reports motion
app.post('/api/motion', (_req, res) => {
  const event = db.recordMotion();
  const state = db.updateState({ buzzer_active: true, last_motion: event.timestamp });
  db.logAudit('motion_detected', `event #${event.id}`);

  broadcast(dashboards, { type: 'motion', event });
  broadcast(dashboards, { type: 'state', state });
  broadcast(dashboards, { type: 'stats', stats: db.getStats() });

  res.json({ ok: true, event });
});

// Current door + buzzer status
app.get('/api/status', (_req, res) => {
  res.json({
    ...db.getState(),
    deviceOnline: devices.size > 0,
    stats: db.getStats(),
  });
});

// Lock the door
app.post('/api/lock', (_req, res) => {
  const state = db.updateState({ door_locked: true });
  db.logAudit('door_locked');
  broadcast(devices,    { type: 'lock' });
  broadcast(dashboards, { type: 'state', state });
  res.json({ ok: true, state });
});

// Unlock the door (also silences buzzer for safety)
app.post('/api/unlock', (_req, res) => {
  const state = db.updateState({ door_locked: false, buzzer_active: false });
  db.logAudit('door_unlocked');
  broadcast(devices,    { type: 'unlock' });
  broadcast(dashboards, { type: 'state', state });
  res.json({ ok: true, state });
});

// Silence the buzzer
app.post('/api/silence', (_req, res) => {
  const state = db.updateState({ buzzer_active: false });
  db.logAudit('buzzer_silenced');
  broadcast(devices,    { type: 'silence' });
  broadcast(dashboards, { type: 'state', state });
  res.json({ ok: true, state });
});

// Recent motion events
app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json(db.getRecentEvents(limit));
});

// Acknowledge a single event
app.post('/api/events/:id/ack', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'bad id' });

  const ok = db.acknowledgeEvent(id);
  if (!ok) return res.status(404).json({ ok: false });

  db.logAudit('event_acked', `event #${id}`);
  broadcast(dashboards, { type: 'ack', id });
  broadcast(dashboards, { type: 'stats', stats: db.getStats() });
  res.json({ ok: true });
});

// Acknowledge all unacked events
app.post('/api/events/ack-all', (_req, res) => {
  const n = db.acknowledgeAll();
  db.logAudit('events_acked_all', `${n} events`);
  broadcast(dashboards, { type: 'ack-all' });
  broadcast(dashboards, { type: 'stats', stats: db.getStats() });
  res.json({ ok: true, acknowledged: n });
});

// Audit log (for debugging / extras)
app.get('/api/audit', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json(db.getRecentAudit(limit));
});

// 404 fallback for /api
app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'not found' }));

// SPA fallback (must be after /api, and after express.static)
app.get('*', (req, res) => {
  // Let websocket path fail fast if someone hits it via HTTP
  if (req.path === '/ws') return res.status(426).send('Upgrade Required');
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend not built. Run the frontend build step.');
  });
});

// =====================================================================
// Start
// =====================================================================
server.listen(PORT, () => {
  console.log(`[HTTP] http://localhost:${PORT}`);
  console.log(`[WS]   ws://localhost:${PORT}/ws  (?role=device | ?role=dashboard)`);
});
