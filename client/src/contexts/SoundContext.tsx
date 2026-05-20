import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_KEY = 'matchpro-sound-volume';

// ─── Audio context singleton ──────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _audioCtx;
}

// ─── Helper: create a single coin-clink ──────────────────────────────────────
// Modelled after a real gold coin striking a hard surface:
//  1. Short transient click (noise burst)
//  2. Metallic ring: two partials (fundamental + overtone) with fast decay
//  3. Tiny resonant tail
function playSingleCoin(ctx: AudioContext, startTime: number, vol: number) {
  // 1. Impact transient — white noise burst, very short
  const clickLen = Math.floor(ctx.sampleRate * 0.008);
  const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
  const cd = clickBuf.getChannelData(0);
  for (let i = 0; i < clickLen; i++) {
    cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.002));
  }
  const clickSrc = ctx.createBufferSource();
  clickSrc.buffer = clickBuf;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(vol * 0.55, startTime);
  clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.008);
  clickSrc.connect(clickGain);
  clickGain.connect(ctx.destination);
  clickSrc.start(startTime);

  // 2. Metallic ring — two sine partials tuned to gold coin frequencies
  const partials = [
    { freq: 3100, decay: 0.22, amp: 0.45 },  // fundamental ring
    { freq: 5400, decay: 0.14, amp: 0.28 },  // bright overtone
    { freq: 8200, decay: 0.07, amp: 0.12 },  // shimmer
  ];
  partials.forEach(({ freq, decay, amp }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    // Slight pitch drop simulates coin spinning down
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.88, startTime + decay);
    g.gain.setValueAtTime(vol * amp, startTime + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + decay + 0.04);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + decay + 0.05);
  });

  // 3. Rolling tail — soft filtered noise simulating coin settling
  const rollLen = Math.floor(ctx.sampleRate * 0.08);
  const rollBuf = ctx.createBuffer(1, rollLen, ctx.sampleRate);
  const rd = rollBuf.getChannelData(0);
  for (let i = 0; i < rollLen; i++) {
    rd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
  }
  const rollSrc = ctx.createBufferSource();
  rollSrc.buffer = rollBuf;
  const rollFilter = ctx.createBiquadFilter();
  rollFilter.type = 'bandpass';
  rollFilter.frequency.value = 3000;
  rollFilter.Q.value = 1.5;
  const rollGain = ctx.createGain();
  rollGain.gain.setValueAtTime(vol * 0.12, startTime + 0.01);
  rollGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);
  rollSrc.connect(rollFilter);
  rollFilter.connect(rollGain);
  rollGain.connect(ctx.destination);
  rollSrc.start(startTime + 0.01);
}

// ─── Cash-register "cha-ching" accent ────────────────────────────────────────
// Plays once at the start of a multi-coin cascade: a bright rising two-tone chime
function playCashRegister(ctx: AudioContext, startTime: number, vol: number) {
  // Two-tone ascending chime: C6 → E6
  const tones = [
    { freq: 1046.5, start: 0,    dur: 0.18 },  // C6
    { freq: 1318.5, start: 0.12, dur: 0.28 },  // E6
  ];
  tones.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime + start);
    g.gain.setValueAtTime(0, startTime + start);
    g.gain.linearRampToValueAtTime(vol * 0.35, startTime + start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + start + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(startTime + start);
    osc.stop(startTime + start + dur + 0.01);
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Play a single coin clink (for single-match events) */
export function playCoinSound(volume = 1.0, delayMs = 0) {
  try {
    const ctx = getAudioCtx();
    playSingleCoin(ctx, ctx.currentTime + delayMs / 1000, volume);
  } catch {}
}

/** Play a cascading coins shower for multiple matches — with cha-ching opener */
export function playCoinsForMatches(count: number, volume = 1.0) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    if (count >= 3) {
      // Cha-ching accent at the very start
      playCashRegister(ctx, now, volume);
    }

    // Stagger coins: first coin at 0.05s, then every 130–180ms with slight jitter
    const numCoins = Math.min(count, 14);
    for (let i = 0; i < numCoins; i++) {
      const jitter = (Math.random() - 0.5) * 0.04;
      const delay = 0.05 + i * 0.155 + jitter;
      // Slightly vary volume per coin for realism
      const coinVol = volume * (0.75 + Math.random() * 0.25);
      playSingleCoin(ctx, now + delay, coinVol);
    }
  } catch {}
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface SoundContextValue {
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  toggleMute: () => void;
  snoozedUntil: number | null;
  snooze: (minutes: number) => void;
  unsnooze: () => void;
  playTestCoin: () => void;
  playCoins: (count: number) => void;
}

const SoundContext = createContext<SoundContextValue>({
  volume: 0.8,
  setVolume: () => {},
  muted: false,
  setMuted: () => {},
  toggleMute: () => {},
  snoozedUntil: null,
  snooze: () => {},
  unsnooze: () => {},
  playTestCoin: () => {},
  playCoins: () => {},
});

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? parseFloat(stored) : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [muted, setMuted] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const prevVolume = useRef(volume);

  useEffect(() => {
    if (!snoozedUntil) return;
    const remaining = snoozedUntil - Date.now();
    if (remaining <= 0) { setSnoozedUntil(null); return; }
    const t = setTimeout(() => setSnoozedUntil(null), remaining);
    return () => clearTimeout(t);
  }, [snoozedUntil]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) prevVolume.current = volume;
      return !m;
    });
  }, [volume]);

  const snooze = useCallback((minutes: number) => {
    setSnoozedUntil(Date.now() + minutes * 60 * 1000);
  }, []);

  const unsnooze = useCallback(() => setSnoozedUntil(null), []);

  const isSilent = muted || (snoozedUntil !== null && snoozedUntil > Date.now());
  const effectiveVolume = isSilent ? 0 : volume;

  const playTestCoin = useCallback(() => {
    // Test plays 3 coins so you can hear the full cascade + cha-ching
    playCoinsForMatches(3, volume === 0 ? 0.8 : volume);
  }, [volume]);

  const playCoins = useCallback((count: number) => {
    if (effectiveVolume > 0) {
      playCoinsForMatches(count, effectiveVolume);
    }
  }, [effectiveVolume]);

  return (
    <SoundContext.Provider value={{
      volume, setVolume,
      muted, setMuted, toggleMute,
      snoozedUntil, snooze, unsnooze,
      playTestCoin, playCoins,
    }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
