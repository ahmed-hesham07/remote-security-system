const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'security.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS motion_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp    DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged INTEGER  DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    action    TEXT NOT NULL,
    detail    TEXT
  );

  CREATE TABLE IF NOT EXISTS system_state (
    id            INTEGER PRIMARY KEY,
    door_locked   INTEGER  DEFAULT 1,
    buzzer_active INTEGER  DEFAULT 0,
    last_motion   DATETIME
  );

  INSERT OR IGNORE INTO system_state (id, door_locked, buzzer_active)
  VALUES (1, 1, 0);
`);

const stmt = {
  insertMotion:    db.prepare('INSERT INTO motion_events DEFAULT VALUES'),
  getMotionById:   db.prepare('SELECT * FROM motion_events WHERE id = ?'),
  recentEvents:    db.prepare('SELECT * FROM motion_events ORDER BY id DESC LIMIT ?'),
  ackEvent:        db.prepare('UPDATE motion_events SET acknowledged = 1 WHERE id = ?'),
  ackAll:          db.prepare('UPDATE motion_events SET acknowledged = 1 WHERE acknowledged = 0'),
  unackCount:      db.prepare('SELECT COUNT(*) AS c FROM motion_events WHERE acknowledged = 0'),
  countToday:      db.prepare(`SELECT COUNT(*) AS c FROM motion_events
                               WHERE timestamp >= date('now', 'start of day')`),
  countWeek:       db.prepare(`SELECT COUNT(*) AS c FROM motion_events
                               WHERE timestamp >= date('now', '-6 days', 'start of day')`),
  insertAudit:     db.prepare('INSERT INTO audit_log (action, detail) VALUES (?, ?)'),
  recentAudit:     db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?'),
  getState:        db.prepare('SELECT * FROM system_state WHERE id = 1'),
};

function rowToEvent(row) {
  return row && {
    id: row.id,
    timestamp: row.timestamp,
    acknowledged: !!row.acknowledged,
  };
}

function rowToState(row) {
  return {
    door_locked:   !!row.door_locked,
    buzzer_active: !!row.buzzer_active,
    last_motion:   row.last_motion,
  };
}

function recordMotion() {
  const info = stmt.insertMotion.run();
  return rowToEvent(stmt.getMotionById.get(info.lastInsertRowid));
}

function getRecentEvents(limit = 50) {
  return stmt.recentEvents.all(Math.max(1, Math.min(limit, 500))).map(rowToEvent);
}

function acknowledgeEvent(id) {
  return stmt.ackEvent.run(id).changes > 0;
}

function acknowledgeAll() {
  return stmt.ackAll.run().changes;
}

function getStats() {
  return {
    today:        stmt.countToday.get().c,
    week:         stmt.countWeek.get().c,
    unacked:      stmt.unackCount.get().c,
  };
}

function logAudit(action, detail) {
  stmt.insertAudit.run(action, detail || null);
}

function getRecentAudit(limit = 50) {
  return stmt.recentAudit.all(Math.max(1, Math.min(limit, 500)));
}

function getState() {
  return rowToState(stmt.getState.get());
}

function updateState(patch) {
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!['door_locked', 'buzzer_active', 'last_motion'].includes(k)) continue;
    fields.push(`${k} = ?`);
    values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
  }
  if (!fields.length) return getState();
  db.prepare(`UPDATE system_state SET ${fields.join(', ')} WHERE id = 1`).run(...values);
  return getState();
}

module.exports = {
  recordMotion,
  getRecentEvents,
  acknowledgeEvent,
  acknowledgeAll,
  getStats,
  logAudit,
  getRecentAudit,
  getState,
  updateState,
};
