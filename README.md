# Remote Security System

An ESP32-based IoT door security demo.

- **PIR sensor** detects motion in front of a door.
- **Buzzer** fires automatically on detection.
- **Web dashboard** notifies a guard in real time.
- The guard can **silence the buzzer** and **lock/unlock the door** remotely.
- Every motion event is **logged with a timestamp** in SQLite.

## Architecture

```
   ┌────────────────┐  HTTP POST /api/motion        ┌──────────────────┐  WebSocket /ws  ┌──────────────────┐
   │     ESP32      │ ─────────────────────────────▶│    Node.js API   │ ◀─────────────▶ │  React dashboard │
   │  PIR + Buzzer  │                               │  Express + ws    │                 │   (Vite, dark)   │
   │  Servo + LEDs  │ ◀───────── WebSocket ─────────│  SQLite (events) │                 │                  │
   └────────────────┘   commands: lock / unlock /   └──────────────────┘                 └──────────────────┘
                        silence / buzz
```

The ESP32 reports motion via plain HTTP POST and holds an open WebSocket
to receive `lock` / `unlock` / `silence` commands instantly. Browser
dashboards subscribe to the same WebSocket as `?role=dashboard` to get
live alerts and state pushes.

## Folder layout

```
remote-security-system/
├── firmware/                ESP32 Arduino sketch
│   └── esp32_security.ino
├── backend/                 Node.js + Express + ws + SQLite
│   ├── server.js
│   ├── db.js
│   ├── simulator.js         fake ESP32 for dashboard development
│   └── package.json
├── frontend/                React + Vite dashboard
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── useWebSocket.js
│   │   ├── sound.js
│   │   ├── format.js
│   │   ├── styles.css
│   │   └── components/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docs/
│   ├── WIRING.md
│   └── API.md
└── demo/                    photos of the cardboard mockup
```

## Quick start (without the ESP32)

You can develop the whole dashboard before any hardware arrives.

```powershell
# Terminal 1 — backend
cd backend
npm install
npm run dev

# Terminal 2 — fake ESP32 (motion every ~15s, reacts to commands)
cd backend
npm run simulate

# Terminal 3 — dashboard
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. You should see the device come online,
motion events appearing every ~15 seconds, the red banner flashing,
and the lock/unlock/silence buttons working.

## Hosting on Render (website + API)

This repo is ready to deploy as **one Render web service**:
- The backend serves the React build (`frontend/dist`)
- WebSockets are hosted at the same URL (`/ws`)
- SQLite is stored on a small persistent disk

### Steps

1. Push this project to a GitHub repo.
2. In Render, click **New +** → **Blueprint** → pick your repo.
3. Render will detect `render.yaml` and create the service automatically.
4. Wait for the deploy to finish, then open your site:
   - Dashboard: `https://<your-service>.onrender.com`
   - API: `https://<your-service>.onrender.com/api/status`

### Important notes

- **Cold start**: on the free plan, the first request after idling can take time.
- **WebSocket**: works automatically at `wss://<your-service>.onrender.com/ws`.
- **DB persistence**: motion events persist because Render mounts a disk at `/var/data`.

## Running with the real ESP32

1. Wire the breadboard per [`docs/WIRING.md`](docs/WIRING.md).
2. Install the Arduino libraries:
   - **WebSockets** by Markus Sattler
   - **ArduinoJson** by Benoit Blanchon
   - **ESP32Servo** by Kevin Harrington
3. Open `firmware/esp32_security.ino` in the Arduino IDE.
4. At the top of the file, set:
   - `WIFI_SSID`, `WIFI_PASS` — your WiFi
   - For **Render**:
     - `SERVER_HOST` = `your-service-name.onrender.com`
     - `USE_TLS` = `true`
   - For **local** hosting:
     - `SERVER_HOST` = your laptop LAN IP (run `ipconfig` in PowerShell)
     - `USE_TLS` = `false`
5. Select board: **ESP32 Dev Module** and flash.
6. Open Serial Monitor at 115200 to watch boot logs.
7. If you run local hosting, make sure the laptop firewall allows inbound TCP on port 3000.

## Docker (run on your laptop IP)

This is the easiest “LAN demo” setup: your laptop runs Docker, and your ESP32/phone connect to the laptop’s **WiFi IP**.

### Start

```powershell
docker compose up --build
```

Then open the dashboard on any device on the same WiFi:

- `http://<YOUR_LAPTOP_WIFI_IP>:3000`

### Auto-detected URL

On startup, the backend tries to detect your laptop’s LAN IPv4 and exposes it as:
- `baseUrl` in `/api/status`
- displayed in the dashboard header

### If Docker auto-detect is wrong (common on Windows + VPN)

Set `HOST_IP` in `docker-compose.yml` to your WiFi IP (example `192.168.1.23`), then restart:

```powershell
docker compose up --build
```

### ESP32 settings for laptop IP

In `firmware/esp32_security.ino` for local LAN:
- `SERVER_HOST` = `<YOUR_LAPTOP_WIFI_IP>`
- `USE_TLS` = `false`

## API

See [`docs/API.md`](docs/API.md) for the full reference. Key endpoints:

| Method | Path                       | Purpose                          |
|-------:|----------------------------|----------------------------------|
| POST   | `/api/motion`              | ESP32 reports a motion event     |
| GET    | `/api/status`              | Current door + buzzer state      |
| POST   | `/api/lock`                | Lock the door                    |
| POST   | `/api/unlock`              | Unlock the door (and silence)    |
| POST   | `/api/silence`             | Silence the buzzer               |
| GET    | `/api/events?limit=50`     | Recent motion events             |
| POST   | `/api/events/:id/ack`      | Acknowledge a single event       |
| POST   | `/api/events/ack-all`      | Acknowledge all unacked events   |
| WS     | `/ws?role=device`          | ESP32 command channel            |
| WS     | `/ws?role=dashboard`       | Browser real-time updates        |

## Demo flow

1. Walk in front of the PIR.
2. Buzzer fires on the breadboard, red banner flashes on the dashboard,
   browser plays a chirp, event appears at the top of the log.
3. Click **Silence buzzer** — buzzer stops within ~1 second.
4. Click **Unlock door** — servo rotates to 90°, green LED turns on.
5. Click **Lock door** — servo returns to 0°, red LED turns on.
6. Click **Acknowledge all** to clear unacked events.

## Bonus features included

- ✅ Real-time WebSocket alerts (no polling on the dashboard side)
- ✅ Browser sound on motion (Web Audio, no asset files)
- ✅ Per-event and bulk acknowledgement
- ✅ Auto WiFi reconnect + WS reconnect on the ESP32
- ✅ Dashboard auto-reconnect with exponential backoff
- ✅ Today / week motion counters
- ✅ Audit log of every action (`/api/audit`)
- ✅ Mobile-responsive dark UI
- ✅ Hot-reload dev mode for both backend and frontend
