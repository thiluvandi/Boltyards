// Procedural audio (Web Audio): relaxed background music, engine with gear shifts,
// wind/turbo layers and a satisfying "parked" click. No audio files needed.

export function createAudio() {
  let ctx = null;
  let master, musicBus, engineBus;
  let engine = null;
  let muted = false;
  let active = false;
  let musicTimer = null;
  let nextBar = 0;
  let barIndex = 0;
  try { muted = localStorage.getItem('by-muted') === '1'; } catch { /* ignore */ }

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function noiseBuffer(sec = 2) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);

    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    engineBus = ctx.createGain(); engineBus.gain.value = 0.0; engineBus.connect(master);

    // soft echo for the music
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.375;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const wet = ctx.createGain(); wet.gain.value = 0.4;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musicBus);
    musicBus.echo = delay;

    // Air-cooled turbo flat-six: firing tone + harmonics + sub rumble through a growl shaper
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const o3 = ctx.createOscillator(); o3.type = 'sine';
    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    const g3 = ctx.createGain(); g3.gain.value = 0.7;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 2.4); }
    shaper.curve = curve;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1.4;
    const eg = ctx.createGain(); eg.gain.value = 0.05;
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    g1.connect(shaper); g2.connect(shaper); shaper.connect(lp); g3.connect(lp);
    lp.connect(eg); eg.connect(engineBus);
    // flutter on the cylinder pulses gives the flat-six "burble"
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.18;
    lfo.connect(lfoG); lfoG.connect(eg.gain); lfo.start();
    o1.start(); o2.start(); o3.start();

    const wind = ctx.createBufferSource(); wind.buffer = noiseBuffer(); wind.loop = true;
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 700; wbp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0;
    wind.connect(wbp); wbp.connect(wg); wg.connect(engineBus); wind.start();

    // turbo: spooling whistle + a touch of airy whoosh
    const turbo = ctx.createOscillator(); turbo.type = 'sine'; turbo.frequency.value = 1500;
    const tg = ctx.createGain(); tg.gain.value = 0;
    turbo.connect(tg); tg.connect(engineBus); turbo.start();
    const whoosh = ctx.createBufferSource(); whoosh.buffer = noiseBuffer(); whoosh.loop = true;
    const whp = ctx.createBiquadFilter(); whp.type = 'bandpass'; whp.frequency.value = 3200; whp.Q.value = 1.2;
    const whg = ctx.createGain(); whg.gain.value = 0;
    whoosh.connect(whp); whp.connect(whg); whg.connect(engineBus); whoosh.start();

    engine = { o1, o2, o3, lp, eg, wg, wbp, tg, turbo, whg, lfo };
  }

  // ----- recorded engine: granular playback of the Porsche clip -----
  // Tiny overlapping grains are pulled from the recording at the point whose pitch matches the
  // engine's current revs, so there is no obvious loop, even at a steady speed.
  let sample = null;
  const GRAIN = 0.14, TICK = 0.035;
  const hann = (() => { const n = 128, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); return c; })();
  // pitch of the clip's rev-up (seconds -> Hz), measured from the recording
  const REV = [[4.5, 182], [4.75, 208], [5.0, 226], [5.25, 240], [5.5, 255], [5.75, 267], [6.0, 278]];
  const grainState = { fire: 45, wLo: 1, wHi: 0, k: 0 };

  async function loadSample() {
    try {
      const res = await fetch('/audio/porsche.mp3');
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 9000; lpf.connect(engineBus);
      const lo = ctx.createGain(), hi = ctx.createGain();
      lo.connect(lpf); hi.connect(lpf);
      sample = { buf, lpf, lo, hi };
      setInterval(grainTick, TICK * 1000);
    } catch { /* keep the synthesised engine */ }
  }

  function grain(bus, pos, rate, gain) {
    const t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource(); src.buffer = sample.buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueCurveAtTime(hann.map((x) => x * gain), t, GRAIN);
    src.connect(g); g.connect(bus);
    src.start(t, Math.max(0, pos), GRAIN * rate + 0.02);
    src.stop(t + GRAIN + 0.02);
  }

  function grainTick() {
    if (!sample || !active || !ctx || ctx.state !== 'running') return;
    const { fire, wLo, wHi, k } = grainState;
    if (k < 0.01) return;
    const jit = (a) => (Math.random() - 0.5) * a;
    const norm = 0.5; // 4 overlapping hann grains sum to ~2
    if (wLo > 0.02) grain(sample.lo, 1.8 + Math.random() * 2.2, Math.min(4, Math.max(0.6, fire / 60)), wLo * k * norm);
    if (wHi > 0.02) {
      // find where in the rev-up the clip's pitch equals the target
      let pos, base;
      if (fire <= REV[0][1]) { pos = REV[0][0]; base = REV[0][1]; }
      else if (fire >= REV[REV.length - 1][1]) { pos = REV[REV.length - 1][0]; base = REV[REV.length - 1][1]; }
      else {
        let i = 0; while (fire > REV[i + 1][1]) i++;
        const p = (fire - REV[i][1]) / (REV[i + 1][1] - REV[i][1]);
        pos = REV[i][0] + p * (REV[i + 1][0] - REV[i][0]);
        base = fire;
      }
      grain(sample.hi, pos + jit(0.12), fire / base, wHi * k * norm);
    }
  }

  // ----- music -----
  // Cmaj9 – Am9 – Fmaj9 – G6, four seconds per bar
  const CHORDS = [
    [48, 55, 59, 64, 71],
    [45, 55, 60, 64, 71],
    [41, 52, 57, 64, 69],
    [43, 55, 59, 62, 69],
  ];
  const SCALE = [72, 74, 76, 79, 81, 84, 79, 76]; // C major pentatonic, upper register

  function pad(t, notes, dur) {
    notes.forEach((m, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = hz(m);
      o.detune.value = (i - 2) * 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 1.2);
      g.gain.linearRampToValueAtTime(0.05, t + dur - 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.4);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
      o.connect(f); f.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + dur + 1.6);
    });
  }
  function pluck(t, m) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(musicBus); g.connect(musicBus.echo);
    o.start(t); o.stop(t + 1);
  }
  function scheduleMusic() {
    if (!ctx) return;
    while (nextBar < ctx.currentTime + 6) {
      const chord = CHORDS[barIndex % CHORDS.length];
      pad(nextBar, chord, 4);
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.55) pluck(nextBar + i * 0.5, SCALE[Math.floor(Math.random() * SCALE.length)]);
      }
      // gentle bass pulse on beats 1 and 3
      [0, 2].forEach((b) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(chord[0] - 12);
        const g = ctx.createGain(); const t = nextBar + b;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 1.7);
      });
      nextBar += 4; barIndex++;
    }
  }

  // ----- public API -----
  // ----- phones: keep sound on even with the silent switch, and wake after interruptions -----
  let keepAliveEl = null;
  function silentWavUrl() {
    const rate = 8000, n = rate; // one second of silence
    const buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    w(36, 'data'); v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function unlockMobile() {
    // iOS 16.4+: treat the page as media playback so the ringer switch doesn't mute Web Audio
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
    // older iOS: a playing <audio> element does the same job
    try {
      if (!keepAliveEl) {
        keepAliveEl = new Audio(silentWavUrl());
        keepAliveEl.loop = true;
        keepAliveEl.setAttribute('playsinline', '');
        keepAliveEl.volume = 0.01;
      }
      keepAliveEl.play().catch(() => {});
    } catch { /* ignore */ }
    // a silent one-sample buffer played inside the tap unlocks the context
    try {
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination); s.start(0);
    } catch { /* ignore */ }
  }
  const wake = () => {
    if (!active || !ctx || ctx.state === 'running') return;
    ctx.resume().catch(() => {});
    keepAliveEl?.play().catch(() => {});
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  document.addEventListener('pointerdown', wake, true); // phones suspend audio when you switch apps; any touch restarts it

  function start() {
    if (!ctx) {
      build();
      nextBar = ctx.currentTime + 0.2;
      musicTimer = setInterval(scheduleMusic, 1000);
      loadSample();
      scheduleMusic();
    }
    unlockMobile();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    active = true;
  }
  function setActive(on) {
    active = on;
    if (!ctx) return;
    if (on) { ctx.resume(); keepAliveEl?.play().catch(() => {}); } else { ctx.suspend(); keepAliveEl?.pause(); }
  }

  // 4-speed gearbox like the real 930: [start, top] speed of each gear in world units/s
  const GEARS = [[0, 7], [7, 13], [13, 20], [20, 34], [34, 48]];
  let rpm = 900, boostLvl = 0, prevThrottle = false, prevGear = 0, shiftT = 0, lastPop = 0;

  function blowOff(t, amt) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(5200, t); bp.frequency.exponentialRampToValueAtTime(2200, t + 0.5); bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * amt, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.connect(bp); bp.connect(g); g.connect(engineBus); n.start(t); n.stop(t + 0.6);
  }
  function pop(t, amt) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 220 + Math.random() * 260; bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * amt, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(bp); bp.connect(g); g.connect(engineBus); n.start(t); n.stop(t + 0.1);
  }

  /** speed: world units/s (0..46); throttle/braking/boost: booleans; airborne, quiet: booleans */
  function update({ speed, throttle, braking, boost, airborne, quiet }) {
    if (!ctx || !active) return;
    const t = ctx.currentTime;
    const v = Math.abs(speed);

    // which gear are we in, and where in its rev range
    let gear = GEARS.findIndex(([, top]) => v < top);
    if (gear < 0) gear = GEARS.length - 1;
    const [g0, g1] = GEARS[gear];
    const frac = Math.min(1, Math.max(0, (v - g0) / (g1 - g0)));
    const targetRpm = v < 0.4 ? (throttle ? 2400 : 900) : (gear === 0 ? 1700 : 3000 + gear * 250) + frac * (gear === 0 ? 4800 : 3300 - gear * 150);
    // revs follow with a little lag: flares up on throttle, falls away on lift
    rpm += (targetRpm - rpm) * Math.min(1, (throttle ? 9 : 4.5) * 0.016);
    // natural wobble in the revs so a steady speed never sounds frozen or looped
    const wob = 1 + 0.012 * Math.sin(t * 6.1) + 0.008 * Math.sin(t * 11.7 + 1.3) + 0.005 * Math.sin(t * 23.3 + 2.1);
    const fire = ((rpm * wob) / 60) * 3; // flat-six: 3 firing pulses per revolution

    engine.o1.frequency.setTargetAtTime(fire, t, 0.03);
    engine.o2.frequency.setTargetAtTime(fire * 2, t, 0.03);
    engine.o3.frequency.setTargetAtTime(fire * 0.5, t, 0.03);
    engine.lfo.frequency.setTargetAtTime(fire * 0.25, t, 0.1);
    const load = throttle ? 1 : 0.35;
    engine.lp.frequency.setTargetAtTime(380 + rpm * 0.28 * (0.55 + load * 0.45) + (boost ? 300 : 0), t, 0.06);
    engine.eg.gain.setTargetAtTime(sample ? 0.004 : (throttle ? 0.14 : 0.07) + (rpm / 7000) * 0.07, t, 0.05);
    if (sample) {
      const w = Math.min(1, Math.max(0, (fire - 150) / 70)); // blend idle grains -> rev grains with revs
      grainState.fire = fire;
      grainState.wLo = Math.cos(w * Math.PI / 2);
      grainState.wHi = Math.sin(w * Math.PI / 2);
      grainState.k = (throttle ? 1.0 : 0.55) * 0.95;
      sample.lpf.frequency.setTargetAtTime(throttle ? 9000 : 2400, t, 0.1); // muffled on lift-off
    }

    // upshift: quick dip + rev drop
    if (gear > prevGear && throttle) { shiftT = t; engine.eg.gain.setValueAtTime(0.02, t); }
    prevGear = gear;

    // turbo: lags behind throttle and revs, collapses when you lift
    const wantBoost = throttle ? Math.min(1, Math.max(0, (rpm - 2200) / 3600)) : 0;
    const prevBoost = boostLvl;
    boostLvl += (wantBoost - boostLvl) * (wantBoost > boostLvl ? 0.025 : 0.12);
    engine.turbo.frequency.setTargetAtTime(1800 + boostLvl * 4200, t, 0.08);
    engine.tg.gain.setTargetAtTime(boostLvl * 0.02, t, 0.1);
    engine.whg.gain.setTargetAtTime(boostLvl * 0.04, t, 0.1);
    // blow-off valve "pssh" when lifting after real boost
    if (prevThrottle && !throttle && prevBoost > 0.35) blowOff(t, prevBoost);
    // overrun pops and crackles on deceleration at high revs
    if (!throttle && !braking && rpm > 3600 && v > 14 && t - lastPop > 0.08 && Math.random() < 0.18) { pop(t, 0.5 + Math.random() * 0.5); lastPop = t; }
    prevThrottle = throttle;

    engine.wg.gain.setTargetAtTime(Math.min(0.1, v * 0.0025) * (airborne ? 1.4 : 1), t, 0.2);
    engine.wbp.frequency.setTargetAtTime(500 + v * 25, t, 0.2);

    engineBus.gain.setTargetAtTime(quiet ? 0.15 : 1, t, 0.15);
    musicBus.gain.setTargetAtTime(quiet ? 0.6 : 0.5 - Math.min(0.15, v * 0.003), t, 0.3);
  }

  /** satisfying little "parked" click + soft chime */
  function parked() {
    if (!ctx || !active) return;
    const t = ctx.currentTime;
    // click
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.1);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t); n.stop(t + 0.05);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.15);
    // chime
    [[880, 0.06], [1320, 0.11]].forEach(([fr, d]) => {
      const c = ctx.createOscillator(); c.type = 'sine'; c.frequency.value = fr;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t + d);
      cg.gain.exponentialRampToValueAtTime(0.1, t + d + 0.01);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.7);
      c.connect(cg); cg.connect(master); cg.connect(musicBus.echo);
      c.start(t + d); c.stop(t + d + 0.8);
    });
  }

  /** soft thud when bumping into something */
  function bump(strength = 1) {
    if (!ctx || !active) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.4, 0.15 * strength), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('by-muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  return { start, setActive, update, parked, bump, setMuted, get muted() { return muted; }, get state() { return ctx ? ctx.state : 'none'; } };
}
