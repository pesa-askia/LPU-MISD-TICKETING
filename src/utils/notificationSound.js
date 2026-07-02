// Shared AudioContext for admin realtime notification sounds.

const CHIME_COOLDOWN_MS = 750;
const CHIME_NOTES = [
  { freq: 523.25, start: 0 },
  { freq: 659.25, start: 0.16 },
  { freq: 783.99, start: 0.32 },
];

let audioCtx = null;
let resumePromise = null;
let lastPlayedAt = 0;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;

  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContextCtor();
  }

  return audioCtx;
}

async function resumeAudioContext(ctx) {
  if (!ctx || ctx.state === "closed") return false;
  if (ctx.state === "running") return true;

  if (!resumePromise) {
    resumePromise = ctx
      .resume()
      .catch(() => false)
      .finally(() => {
        resumePromise = null;
      });
  }

  await resumePromise;
  return ctx.state === "running";
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function scheduleChime(ctx) {
  const startTime = ctx.currentTime;
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  output.gain.value = 0.9;
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;
  filter.connect(output).connect(ctx.destination);

  CHIME_NOTES.forEach(({ freq, start }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noteStart = startTime + start;
    const noteEnd = noteStart + 0.47;

    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.28, noteStart + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    osc.connect(gain).connect(filter);
    osc.start(noteStart);
    osc.stop(noteEnd + 0.02);
  });
}

export async function ensureNotificationSoundReady() {
  try {
    return resumeAudioContext(getAudioContext());
  } catch {
    return false;
  }
}

export async function playNewTicketSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    const ready = await resumeAudioContext(ctx);
    if (!ready) return false;

    const currentTimeMs = nowMs();
    if (currentTimeMs - lastPlayedAt < CHIME_COOLDOWN_MS) return false;

    lastPlayedAt = currentTimeMs;
    scheduleChime(ctx);
    return true;
  } catch {
    return false;
  }
}

// Prime the context on the first user gesture since browsers start it suspended.
export function installAudioUnlock() {
  if (typeof window === "undefined") return () => {};

  let disposed = false;

  const removeListeners = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  const unlock = () => {
    void ensureNotificationSoundReady().then((ready) => {
      if (!disposed && ready) removeListeners();
    });
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  return () => {
    disposed = true;
    removeListeners();
  };
}
