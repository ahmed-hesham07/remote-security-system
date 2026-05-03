/**
 * Tiny Web Audio chirp used as a browser-side motion alert.
 * No audio files needed.
 */
let ctx;

function getCtx() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function playAlert() {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume();

  const beep = (startOffset, freq, duration = 0.18) => {
    const t0 = ac.currentTime + startOffset;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  };

  beep(0,    880);
  beep(0.22, 660);
  beep(0.44, 880);
}
