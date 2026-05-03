import { formatRelative } from '../format.js';

export default function StatusPanel({ state, stats }) {
  const locked = !!state?.door_locked;
  const buzzing = !!state?.buzzer_active;

  return (
    <section className="card">
      <h2 className="card-title">Status</h2>

      <div className="status-grid">
        <StatusTile
          label="Door"
          value={locked ? 'LOCKED' : 'UNLOCKED'}
          tone={locked ? 'danger' : 'success'}
          icon={locked ? '🔒' : '🔓'}
        />
        <StatusTile
          label="Buzzer"
          value={buzzing ? 'ALARMING' : 'SILENT'}
          tone={buzzing ? 'warn' : 'neutral'}
          icon={buzzing ? '🔔' : '🔕'}
          pulse={buzzing}
        />
        <StatusTile
          label="Last motion"
          value={state?.last_motion ? formatRelative(state.last_motion) : 'No events yet'}
          tone="neutral"
          icon="🕒"
        />
        <StatusTile
          label="Today / Week"
          value={`${stats?.today ?? 0} / ${stats?.week ?? 0}`}
          tone="neutral"
          icon="📊"
          subtitle={`${stats?.unacked ?? 0} unacked`}
        />
      </div>
    </section>
  );
}

function StatusTile({ label, value, tone, icon, subtitle, pulse }) {
  return (
    <div className={`tile tile-${tone}${pulse ? ' tile-pulse' : ''}`}>
      <div className="tile-icon" aria-hidden>{icon}</div>
      <div className="tile-meta">
        <div className="tile-label">{label}</div>
        <div className="tile-value">{value}</div>
        {subtitle && <div className="tile-sub">{subtitle}</div>}
      </div>
    </div>
  );
}
