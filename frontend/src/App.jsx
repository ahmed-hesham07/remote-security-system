import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useWebSocket } from './useWebSocket.js';
import { playAlert } from './sound.js';

import Header       from './components/Header.jsx';
import AlertBanner  from './components/AlertBanner.jsx';
import StatusPanel  from './components/StatusPanel.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import EventLog     from './components/EventLog.jsx';

const DEFAULT_STATE = { door_locked: true, buzzer_active: false, last_motion: null };
const DEFAULT_STATS = { today: 0, week: 0, unacked: 0 };

export default function App() {
  const [state, setState]               = useState(DEFAULT_STATE);
  const [stats, setStats]               = useState(DEFAULT_STATS);
  const [events, setEvents]             = useState([]);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [activeAlert, setActiveAlert]   = useState(null);
  const [soundOn, setSoundOn]           = useState(true);
  const [error, setError]               = useState(null);
  const [baseUrl, setBaseUrl]           = useState('');

  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  // Force a tick every 30s so "X min ago" updates without page reload.
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Bootstrap via REST in case the dashboard loads before WS opens.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [s, evs] = await Promise.all([api.status(), api.events(50)]);
        if (!mounted) return;
        setState({
          door_locked:   s.door_locked,
          buzzer_active: s.buzzer_active,
          last_motion:   s.last_motion,
        });
        setStats(s.stats || DEFAULT_STATS);
        setDeviceOnline(!!s.deviceOnline);
        setBaseUrl(s.baseUrl || '');
        setEvents(evs);
        const firstUnacked = evs.find((e) => !e.acknowledged);
        if (firstUnacked) setActiveAlert(firstUnacked);
      } catch (err) {
        setError('Cannot reach backend on /api. Is the server running?');
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'hello':
        if (typeof msg.deviceOnline === 'boolean') setDeviceOnline(msg.deviceOnline);
        break;
      case 'device':
        setDeviceOnline(!!msg.online);
        break;
      case 'state':
        setState(msg.state);
        break;
      case 'stats':
        setStats(msg.stats);
        break;
      case 'events':
        setEvents(msg.events);
        break;
      case 'motion':
        setEvents((prev) => [msg.event, ...prev].slice(0, 200));
        setActiveAlert(msg.event);
        if (soundRef.current) playAlert();
        break;
      case 'ack':
        setEvents((prev) => prev.map((e) => (e.id === msg.id ? { ...e, acknowledged: true } : e)));
        setActiveAlert((cur) => (cur && cur.id === msg.id ? null : cur));
        break;
      case 'ack-all':
        setEvents((prev) => prev.map((e) => ({ ...e, acknowledged: true })));
        setActiveAlert(null);
        break;
      default:
        break;
    }
  }, []);

  const { connected: wsConnected } = useWebSocket(handleMessage);

  const guard = (fn) => async () => {
    try { await fn(); setError(null); }
    catch (err) { setError(err.message); }
  };

  const onLock    = guard(() => api.lock());
  const onUnlock  = guard(() => api.unlock());
  const onSilence = guard(() => api.silence());
  const onAckAll  = guard(() => api.ackAll());

  const onAckEvent = async (id) => {
    try { await api.ackEvent(id); }
    catch (err) { setError(err.message); }
  };

  const onAckBanner = () => {
    if (activeAlert) onAckEvent(activeAlert.id);
    setActiveAlert(null);
  };

  return (
    <div className="app">
      <Header
        wsConnected={wsConnected}
        deviceOnline={deviceOnline}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((s) => !s)}
        baseUrl={baseUrl}
      />

      {error && <div className="banner-error">{error}</div>}

      <main className="main">
        <AlertBanner event={activeAlert} onAcknowledge={onAckBanner} />
        <StatusPanel state={state} stats={stats} />
        <ControlPanel
          state={state}
          deviceOnline={deviceOnline}
          onLock={onLock}
          onUnlock={onUnlock}
          onSilence={onSilence}
        />
        <EventLog events={events} onAck={onAckEvent} onAckAll={onAckAll} />
      </main>

      <footer className="footer">
        Remote Security System · ESP32 IoT demo
      </footer>
    </div>
  );
}
