/* Оригинальные звуки клуба, синтезированные через Web Audio API (никаких записей из передачи). */
const SFX = (() => {
  let ctx = null, master = null, muted = false, bbNodes = null, bbTimer = null;
  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const now = () => ctx.currentTime;
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freq, t, dur, { type = 'sine', vol = 0.3, attack = 0.005, dest = master, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    env(g, t, attack, vol, dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + attack + dur + 0.05);
    return o;
  }
  function noise(t, dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', dest = master } = {}) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.003, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.05);
  }
  let rvIn = null;
  function reverbSend() {
    if (rvIn) return rvIn;
    // простая «зальная» реверберация из линий задержки
    const inp = ctx.createGain(); inp.gain.value = 1;
    [0.11, 0.17, 0.23].forEach((dt, i) => {
      const d = ctx.createDelay(1); d.delayTime.value = dt;
      const fb = ctx.createGain(); fb.gain.value = 0.42 - i * 0.06;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      inp.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
    });
    rvIn = inp; return inp;
  }
  const api = {
    unlock() { init(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; },
    isMuted: () => muted,
    gong() {
      if (!init()) return; const t = now() + 0.02, rv = reverbSend();
      const base = 82;
      [[1, .5, 6], [2.41, .22, 4.5], [2.98, .16, 4], [4.07, .1, 3], [5.43, .06, 2.4], [6.8, .04, 1.8], [1.5, .12, 5]].forEach(([r, v, d]) => {
        tone(base * r, t, d, { vol: v, attack: 0.01, dest: master });
        tone(base * r, t, d * 0.6, { vol: v * 0.4, attack: 0.01, dest: rv, detune: 7 });
      });
      noise(t, 0.35, { vol: 0.25, freq: 500, q: 0.6 });
    },
    horn() { // торжественный «горн» начала минуты
      if (!init()) return; const t = now() + 0.02, rv = reverbSend();
      const brass = (f, st, d, v = .16) => {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 9;
        lp.type = 'lowpass'; lp.Q.value = 2;
        lp.frequency.setValueAtTime(300, st); lp.frequency.linearRampToValueAtTime(2600, st + 0.08); lp.frequency.linearRampToValueAtTime(1500, st + d);
        g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(v, st + 0.05);
        g.gain.setValueAtTime(v, st + d - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, st + d + 0.25);
        o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master); g.connect(rv);
        o.start(st); o2.start(st); o.stop(st + d + 0.3); o2.stop(st + d + 0.3);
      };
      brass(392, t, 0.16); brass(523.25, t + 0.18, 0.16); brass(659.25, t + 0.36, 0.7, .18); brass(523.25, t + 0.36, 0.7, .1);
    },
    tick(strong) {
      if (!init()) return; const t = now() + 0.005;
      noise(t, 0.03, { vol: strong ? 0.35 : 0.16, freq: strong ? 2400 : 3400, q: 8 });
      tone(strong ? 1300 : 1900, t, 0.025, { vol: strong ? 0.12 : 0.05, type: 'triangle' });
    },
    warning() { // «осталось 10 секунд»
      if (!init()) return; const t = now() + 0.02;
      [0, 0.22].forEach(dt => { tone(880, t + dt, 0.16, { vol: 0.3, type: 'square', attack: 0.004 }); tone(1320, t + dt, 0.16, { vol: 0.12, type: 'sine' }); });
    },
    timeUp() { // «время вышло»
      if (!init()) return; const t = now() + 0.02, rv = reverbSend();
      [[523.25, 0], [392, 0.28], [261.63, 0.56]].forEach(([f, dt]) => {
        tone(f, t + dt, dt === 0.56 ? 1.4 : 0.3, { vol: 0.28, type: 'triangle', dest: master });
        tone(f / 2, t + dt, dt === 0.56 ? 1.4 : 0.3, { vol: 0.18, type: 'sine', dest: rv });
      });
      noise(t + 0.56, 0.5, { vol: 0.08, freq: 180, q: 0.7 });
    },
    point(good = true) { // короткие фанфары
      if (!init()) return; const t = now() + 0.02, rv = reverbSend();
      const seq = good ? [[523.25, 0, .12], [659.25, .12, .12], [783.99, .24, .12], [1046.5, .38, .8]] : [[392, 0, .18], [349.23, .2, .18], [293.66, .42, .7]];
      seq.forEach(([f, dt, d]) => {
        tone(f, t + dt, d, { vol: .22, type: 'sawtooth', attack: .01, dest: rv });
        tone(f, t + dt, d, { vol: .2, type: 'triangle', attack: .01 });
        if (good && dt > .3) { tone(f * 1.25, t + dt, d, { vol: .1, type: 'triangle' }); tone(f * 1.5, t + dt, d, { vol: .1, type: 'triangle' }); }
      });
    },
    victory() {
      if (!init()) return; const t = now() + 0.02, rv = reverbSend();
      const notes = [[392, 0, .18], [392, .2, .18], [392, .4, .18], [523.25, .6, .5], [659.25, 1.15, .25], [587.33, 1.42, .25], [783.99, 1.7, 1.6]];
      notes.forEach(([f, dt, d]) => {
        tone(f, t + dt, d, { vol: .2, type: 'sawtooth', dest: rv }); tone(f, t + dt, d, { vol: .18, type: 'triangle' });
        tone(f / 2, t + dt, d, { vol: .12, type: 'sine' });
      });
      [523.25, 659.25, 783.99].forEach(f => tone(f, t + 1.7, 1.6, { vol: .08, type: 'triangle' }));
      api.gong();
    },
    spin(duration) { // трещотка волчка, замедляющаяся
      if (!init()) return; let t = now() + 0.02, i = 0, dt = 0.035;
      while (t < now() + duration) { noise(t, 0.018, { vol: 0.12, freq: 3000, q: 6 }); t += dt; dt *= 1.045; i++; }
    },
    blackBoxStart() {
      if (!init() || bbNodes) return;
      const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, now()); out.gain.exponentialRampToValueAtTime(0.8, now() + 1.2); out.connect(master);
      const rv = ctx.createGain(); rv.connect(reverbSend());
      // низкий гул
      const drones = [55, 82.4, 110.6].map((f, i) => {
        const o = ctx.createOscillator(); o.type = i ? 'sine' : 'sawtooth'; o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
        const g = ctx.createGain(); g.gain.value = i ? 0.09 : 0.06;
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.15 + i * 0.07; lg.gain.value = 120;
        lfo.connect(lg); lg.connect(lp.frequency);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(); lfo.start();
        return [o, lfo];
      }).flat();
      bbNodes = { out, drones };
      // загадочное арпеджио (ля минор, хроматический спуск) + «сердце»
      const arp = [440, 523.25, 659.25, 622.25, 587.33, 523.25, 493.88, 415.3];
      let step = 0;
      const loop = () => {
        const t = now() + 0.05;
        const f = arp[step % arp.length];
        tone(f, t, 0.5, { vol: 0.07, type: 'triangle', dest: out }); tone(f * 2, t, 0.35, { vol: 0.025, type: 'sine', dest: rv });
        if (step % 2 === 0) { tone(55, t, 0.18, { vol: 0.35, dest: out }); tone(52, t + 0.2, 0.2, { vol: 0.25, dest: out }); }
        step++;
      };
      loop(); bbTimer = setInterval(loop, 600);
    },
    blackBoxStop() {
      if (bbTimer) { clearInterval(bbTimer); bbTimer = null; }
      if (bbNodes && ctx) {
        const { out, drones } = bbNodes; const t = now();
        out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value || 0.5, t); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        drones.forEach(o => o.stop(t + 0.9)); bbNodes = null;
      }
    }
  };
  return api;
})();
