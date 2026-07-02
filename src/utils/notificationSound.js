// Shared AudioContext for admin realtime notification sounds.

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

// Warm chime: sine C5/E5/G5 triad, lowpass filtered, soft envelopes to avoid clipping.
export function playNewTicketSound() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 1.0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.connect(master).connect(ctx.destination);

    const notes = [
      { freq: 523, start: 0 },
      { freq: 659, start: 0.16 },
      { freq: 784, start: 0.32 },
    ];
    notes.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + start;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(filter);
      osc.start(t);
      osc.stop(t + 0.47);
    });
  } catch {
    // ignore — audio not critical
  }
}

// Prime the context on first click/keypress since browsers start it suspended. Returns cleanup.
export function installAudioUnlock() {
  const unlock = () => {
    try {
      const ctx = getCtx();
      if (ctx && ctx.state === "suspended") ctx.resume();
    } catch {
      // ignore, audio not critical
    }
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}
