import { useState } from 'react';

export default function ControlPanel({ state, deviceOnline, onLock, onUnlock, onSilence }) {
  const [busy, setBusy] = useState(null);

  const wrap = (key, fn) => async () => {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  };

  const locked = !!state?.door_locked;
  const buzzing = !!state?.buzzer_active;

  return (
    <section className="card">
      <h2 className="card-title">Controls</h2>

      {!deviceOnline && (
        <div className="notice">
          Device is offline — commands will queue but won't take effect until it reconnects.
        </div>
      )}

      <div className="controls">
        <button
          className="btn btn-success"
          disabled={!locked || busy !== null}
          onClick={wrap('unlock', onUnlock)}
        >
          {busy === 'unlock' ? '...' : 'Unlock door'}
        </button>

        <button
          className="btn btn-danger"
          disabled={locked || busy !== null}
          onClick={wrap('lock', onLock)}
        >
          {busy === 'lock' ? '...' : 'Lock door'}
        </button>

        <button
          className="btn btn-warn"
          disabled={!buzzing || busy !== null}
          onClick={wrap('silence', onSilence)}
        >
          {busy === 'silence' ? '...' : 'Silence buzzer'}
        </button>
      </div>
    </section>
  );
}
