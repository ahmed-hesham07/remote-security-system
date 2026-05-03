import { formatTime } from '../format.js';

export default function AlertBanner({ event, onAcknowledge }) {
  if (!event) return null;
  return (
    <div className="alert-banner" role="alert">
      <div className="alert-text">
        <span className="alert-icon" aria-hidden>!</span>
        <div>
          <strong>MOTION DETECTED</strong>
          <span className="alert-time"> · {formatTime(event.timestamp)}</span>
        </div>
      </div>
      <button className="btn btn-ghost" onClick={onAcknowledge}>
        Acknowledge
      </button>
    </div>
  );
}
