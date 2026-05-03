export default function Header({ wsConnected, deviceOnline, soundOn, onToggleSound }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo" aria-hidden>SS</span>
        <div>
          <h1>Remote Security System</h1>
          <p className="tagline">Operator console</p>
        </div>
      </div>

      <div className="header-status">
        <button
          className={`sound-toggle ${soundOn ? 'on' : 'off'}`}
          onClick={onToggleSound}
          title={soundOn ? 'Mute alerts' : 'Unmute alerts'}
        >
          {soundOn ? 'Sound: ON' : 'Sound: OFF'}
        </button>

        <span className={`pill ${wsConnected ? 'pill-ok' : 'pill-bad'}`}>
          <span className="dot" />
          {wsConnected ? 'Server' : 'No server'}
        </span>

        <span className={`pill ${deviceOnline ? 'pill-ok' : 'pill-warn'}`}>
          <span className="dot" />
          {deviceOnline ? 'Device' : 'Device offline'}
        </span>
      </div>
    </header>
  );
}
