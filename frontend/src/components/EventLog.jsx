import { formatTime, formatRelative } from '../format.js';

export default function EventLog({ events, onAck, onAckAll }) {
  const unacked = events.filter((e) => !e.acknowledged).length;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Event log</h2>
        {unacked > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={onAckAll}>
            Acknowledge all ({unacked})
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="empty">No motion events recorded yet.</div>
      ) : (
        <ul className="event-list">
          {events.map((e) => (
            <li key={e.id} className={`event ${e.acknowledged ? 'event-ack' : 'event-new'}`}>
              <div className="event-dot" />
              <div className="event-meta">
                <div className="event-title">Motion detected</div>
                <div className="event-time">
                  {formatTime(e.timestamp)} · {formatRelative(e.timestamp)}
                </div>
              </div>
              {e.acknowledged ? (
                <span className="badge">Acked</span>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => onAck(e.id)}>
                  Ack
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
