# API Reference

Base URL: `http://<server>:3000`

All POST endpoints accept (and ignore) an empty JSON body.

## REST

### `POST /api/motion`
ESP32 reports a motion event.

Response:
```json
{ "ok": true, "event": { "id": 12, "timestamp": "...", "acknowledged": false } }
```
Side effect: server sets `buzzer_active=true`, broadcasts a `motion`
message and an updated `state` to all dashboards.

### `GET /api/status`
```json
{
  "door_locked": true,
  "buzzer_active": false,
  "last_motion": "2026-05-03 13:24:55",
  "deviceOnline": true,
  "stats": { "today": 4, "week": 17, "unacked": 1 }
}
```

### `POST /api/lock`
Sends `{ "type": "lock" }` to the device, sets `door_locked=true`.

### `POST /api/unlock`
Sends `{ "type": "unlock" }`, sets `door_locked=false` and
`buzzer_active=false` (unlocking implicitly silences any active alarm).

### `POST /api/silence`
Sends `{ "type": "silence" }`, sets `buzzer_active=false`.

### `GET /api/events?limit=50`
```json
[
  { "id": 12, "timestamp": "...", "acknowledged": false },
  { "id": 11, "timestamp": "...", "acknowledged": true  }
]
```

### `POST /api/events/:id/ack`
Mark a single event as acknowledged. `404` if it doesn't exist.

### `POST /api/events/ack-all`
```json
{ "ok": true, "acknowledged": 3 }
```

### `GET /api/audit?limit=100`
Returns the audit log of all guard actions and device connect/disconnect
events. Useful when grading or debugging.

### `GET /api/health`
```json
{ "ok": true, "deviceOnline": true }
```

## WebSocket `/ws`

Two roles via the `role` query parameter:

- `?role=device` — the ESP32 (or simulator)
- `?role=dashboard` — a browser

### Server → device

| Message                | Meaning                                 |
|------------------------|-----------------------------------------|
| `{ "type": "lock" }`     | rotate servo to locked, red LED on    |
| `{ "type": "unlock" }`   | rotate servo to unlocked, green LED on, silence buzzer |
| `{ "type": "silence" }`  | turn buzzer off                       |
| `{ "type": "buzz" }`     | turn buzzer on (sent only on initial state sync) |

### Server → dashboard

| Message                                  | Meaning                                      |
|------------------------------------------|----------------------------------------------|
| `{ "type": "hello", "deviceOnline" }`    | sent on connect                              |
| `{ "type": "device", "online" }`         | device came online or went offline           |
| `{ "type": "state", "state" }`           | full system state snapshot                   |
| `{ "type": "stats", "stats" }`           | counters (today/week/unacked)                |
| `{ "type": "events", "events" }`         | initial recent events on connect             |
| `{ "type": "motion", "event" }`          | new motion event                             |
| `{ "type": "ack", "id" }`                | one event was acknowledged                   |
| `{ "type": "ack-all" }`                  | all events were acknowledged                 |

The dashboard does not send messages back over the WebSocket — guard
actions go through the REST API.
