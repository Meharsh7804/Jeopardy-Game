export type SoundTheme = "classic" | "arcade" | "retro";

interface ThemeCfg {
  buzzer: {
    click: { type: OscillatorType; freq: number; endFreq: number; dur: number };
    body: {
      type: OscillatorType;
      freqs: number[];
      startFreq: number;
      endFreq: number;
      dur: number;
      detune: number;
    };
  };
  correct: { notes: number[]; type: OscillatorType; step: number; dur: number };
  wrong: { type: OscillatorType; freqs: number[]; startFreq: number; endFreq: number; dur: number };
  tick: { type: OscillatorType; freq: number; dur: number };
  reveal: { type: OscillatorType; startFreq: number; endFreq: number; dur: number };
  pop: { type: OscillatorType; startFreq: number; endFreq: number; dur: number };
  winner: { chords: number[][]; type: OscillatorType; lastDur: number };
  intro: {
    notes: number[];
    finalChord: number[];
    type: OscillatorType;
    step: number;
    dur: number;
    finalDur: number;
  };
}

// Every sound is synthesized live with Web Audio (no assets). Each theme
// re-parameters the same primitives: oscillators, pitch sweeps, and gain
// envelopes. "classic" is the original mechanical game-show set, "arcade" is
// an 8-bit square-wave set, "retro" is a brassier game-show set.
const THEMES: Record<SoundTheme, ThemeCfg> = {
  classic: {
    buzzer: {
      click: { type: "square", freq: 1900, endFreq: 320, dur: 0.04 },
      body: {
        type: "sawtooth",
        freqs: [130, 133],
        startFreq: 130,
        endFreq: 95,
        dur: 0.45,
        detune: 10,
      },
    },
    correct: {
      notes: [261.63, 329.63, 392.0, 523.25], // C4 E4 G4 C5
      type: "sine",
      step: 0.08,
      dur: 0.3,
    },
    wrong: { type: "triangle", freqs: [146.83, 110.0], startFreq: 146.83, endFreq: 75.0, dur: 0.6 },
    tick: { type: "sine", freq: 1000, dur: 0.03 },
    reveal: { type: "triangle", startFreq: 293.66, endFreq: 880.0, dur: 0.4 },
    pop: { type: "sine", startFreq: 520, endFreq: 980, dur: 0.12 },
    winner: {
      chords: [
        [261.63, 329.63, 392.0, 523.25], // C major
        [349.23, 440.0, 523.25, 698.46], // F major
        [392.0, 493.88, 587.33, 783.99], // G major
        [523.25, 659.25, 783.99, 1046.5], // C major high
        [659.25, 830.61, 987.77, 1318.51], // E major cap
      ],
      type: "triangle",
      lastDur: 1.1,
    },
    intro: {
      notes: [392.0, 523.25, 659.25, 783.99], // G4 C5 E5 G5 fanfare run
      finalChord: [523.25, 659.25, 783.99, 1046.5], // C major chord
      type: "sine",
      step: 0.09,
      dur: 0.12,
      finalDur: 0.9,
    },
  },
  arcade: {
    buzzer: {
      click: { type: "square", freq: 2400, endFreq: 600, dur: 0.03 },
      body: {
        type: "square",
        freqs: [150, 157],
        startFreq: 150,
        endFreq: 115,
        dur: 0.28,
        detune: 0,
      },
    },
    correct: {
      notes: [523.25, 659.25, 783.99, 1046.5], // C5 E5 G5 C6
      type: "square",
      step: 0.055,
      dur: 0.12,
    },
    wrong: { type: "square", freqs: [220, 165], startFreq: 220, endFreq: 60, dur: 0.4 },
    tick: { type: "square", freq: 1500, dur: 0.025 },
    reveal: { type: "square", startFreq: 400, endFreq: 1200, dur: 0.25 },
    pop: { type: "square", startFreq: 660, endFreq: 1320, dur: 0.09 },
    winner: {
      chords: [
        [523.25, 659.25, 783.99, 1046.5], // C5 major
        [698.46, 880.0, 1046.5, 1396.91], // F5 major
        [783.99, 987.77, 1174.66, 1567.98], // G5 major
        [1046.5, 1318.51, 1567.98, 2093.0], // C6 major high
        [1318.51, 1661.22, 1975.53, 2637.02], // E6 major cap
      ],
      type: "square",
      lastDur: 0.75,
    },
    intro: {
      notes: [523.25, 783.99, 1046.5, 1567.98], // C5 G5 C6 G6 arcade run
      finalChord: [1046.5, 1318.51, 1567.98, 2093.0], // C6 major chord
      type: "square",
      step: 0.07,
      dur: 0.1,
      finalDur: 0.7,
    },
  },
  retro: {
    buzzer: {
      click: { type: "square", freq: 1200, endFreq: 250, dur: 0.05 },
      body: {
        type: "sawtooth",
        freqs: [110, 114],
        startFreq: 110,
        endFreq: 85,
        dur: 0.55,
        detune: 22,
      },
    },
    correct: {
      notes: [392.0, 523.25, 659.25, 783.99], // G4 C5 E5 G5 (brass-y)
      type: "sawtooth",
      step: 0.1,
      dur: 0.35,
    },
    wrong: { type: "sawtooth", freqs: [98, 87.31], startFreq: 98, endFreq: 62, dur: 0.7 },
    tick: { type: "sine", freq: 880, dur: 0.03 },
    reveal: { type: "sawtooth", startFreq: 262, endFreq: 880, dur: 0.5 },
    pop: { type: "triangle", startFreq: 440, endFreq: 880, dur: 0.12 },
    winner: {
      chords: [
        [261.63, 329.63, 392.0, 523.25], // C major
        [349.23, 440.0, 523.25, 698.46], // F major
        [392.0, 493.88, 587.33, 783.99], // G major
        [523.25, 659.25, 783.99, 1046.5], // C major high
        [659.25, 830.61, 987.77, 1318.51], // E major cap
      ],
      type: "sawtooth",
      lastDur: 1.3,
    },
    intro: {
      notes: [329.63, 392.0, 493.88, 587.33], // E4 G4 B4 D5 brass run
      finalChord: [392.0, 493.88, 587.33, 783.99], // G major chord
      type: "sawtooth",
      step: 0.12,
      dur: 0.15,
      finalDur: 1.1,
    },
  },
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;
  private theme: SoundTheme = "classic";

  constructor() {
    // Lazily initialized on interaction
  }

  private initCtx() {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      } catch (e) {
        console.error('Web Audio API not supported', e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  updateSettings(volume: number, muted: boolean, theme?: SoundTheme) {
    this.volume = volume;
    this.muted = muted;
    if (theme) this.theme = theme;
    this.initCtx();
  }

  getVolume() {
    return this.volume;
  }

  isMuted() {
    return this.muted;
  }

  private playOscillator(
    type: OscillatorType,
    freqs: number[],
    duration: number,
    pitchSweep?: { startFreq: number; endFreq: number; type: 'exp' | 'linear' },
    detune: number = 0
  ) {
    this.initCtx();
    if (!this.ctx || this.muted || this.volume <= 0) return;

    const now = this.ctx.currentTime;
    const gainNode = this.ctx.createGain();
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gainNode.connect(this.ctx.destination);

    freqs.forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.detune.setValueAtTime(detune, now);

      if (pitchSweep) {
        osc.frequency.setValueAtTime(pitchSweep.startFreq, now);
        if (pitchSweep.type === 'exp') {
          osc.frequency.exponentialRampToValueAtTime(pitchSweep.endFreq, now + duration);
        } else {
          osc.frequency.linearRampToValueAtTime(pitchSweep.endFreq, now + duration);
        }
      } else {
        osc.frequency.setValueAtTime(freq, now);
      }

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + duration);
    });
  }

  playBuzzer() {
    const b = THEMES[this.theme].buzzer;
    // Mechanical press: a sharp click transient (the button) followed by the
    // low buzzing body, so it reads as a physical game-show buzzer.
    this.playOscillator(
      b.click.type,
      [b.click.freq],
      b.click.dur,
      { startFreq: b.click.freq, endFreq: b.click.endFreq, type: 'linear' },
    );
    this.playOscillator(
      b.body.type,
      b.body.freqs,
      b.body.dur,
      { startFreq: b.body.startFreq, endFreq: b.body.endFreq, type: 'linear' },
      b.body.detune,
    );
  }

  playCorrect() {
    this.initCtx();
    if (!this.ctx || this.muted || this.volume <= 0) return;

    const c = THEMES[this.theme].correct;
    const now = this.ctx.currentTime;

    c.notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const noteTime = now + idx * c.step;
      const duration = c.dur;

      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0, noteTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, noteTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, noteTime + duration);
      gainNode.connect(this.ctx.destination);

      const osc = this.ctx.createOscillator();
      osc.type = c.type;
      osc.frequency.setValueAtTime(freq, noteTime);
      osc.connect(gainNode);

      osc.start(noteTime);
      osc.stop(noteTime + duration);
    });
  }

  playWrong() {
    const w = THEMES[this.theme].wrong;
    // Low descending buzzy chord
    this.playOscillator(
      w.type,
      w.freqs,
      w.dur,
      { startFreq: w.startFreq, endFreq: w.endFreq, type: 'linear' },
    );
  }

  playTimerTick() {
    const t = THEMES[this.theme].tick;
    // High-pitched short woodblock tick
    this.playOscillator(t.type, [t.freq], t.dur);
  }

  playIntro() {
    this.initCtx();
    if (!this.ctx || this.muted || this.volume <= 0) return;

    const i = THEMES[this.theme].intro;
    const now = this.ctx.currentTime;
    // Quick ascending fanfare run...
    i.notes.forEach((freq, idx) => {
      const noteTime = now + idx * i.step;
      const gainNode = this.ctx!.createGain();
      gainNode.gain.setValueAtTime(0, noteTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, noteTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, noteTime + i.dur);
      gainNode.connect(this.ctx!.destination);

      const osc = this.ctx!.createOscillator();
      osc.type = i.type;
      osc.frequency.setValueAtTime(freq, noteTime);
      osc.connect(gainNode);
      osc.start(noteTime);
      osc.stop(noteTime + i.dur);
    });

    // ...landing on a big sustained opening chord.
    const chordTime = now + i.notes.length * i.step;
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, chordTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.22, chordTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, chordTime + i.finalDur);
    gainNode.connect(this.ctx.destination);

    i.finalChord.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i.type;
      osc.frequency.setValueAtTime(freq, chordTime);
      osc.connect(gainNode);
      osc.start(chordTime);
      osc.stop(chordTime + i.finalDur);
    });
  }

  playReveal() {
    const r = THEMES[this.theme].reveal;
    // Elegant slide up synthesizer chime
    this.playOscillator(
      r.type,
      [r.startFreq],
      r.dur,
      { startFreq: r.startFreq, endFreq: r.endFreq, type: 'exp' },
    );
  }

  playPop() {
    const p = THEMES[this.theme].pop;
    // Short rising blip for emoji reactions
    this.playOscillator(
      p.type,
      [p.startFreq],
      p.dur,
      { startFreq: p.startFreq, endFreq: p.endFreq, type: 'exp' },
    );
  }

  playWinner() {
    this.initCtx();
    if (!this.ctx || this.muted || this.volume <= 0) return;

    const w = THEMES[this.theme].winner;
    const now = this.ctx.currentTime;
    // Ascending celebratory fanfare chords, one every 250ms, the last one
    // ringing out.
    w.chords.forEach((notes, idx) => {
      const chordTime = now + idx * 0.25;
      const duration = idx === w.chords.length - 1 ? w.lastDur : 0.2;

      const gainNode = this.ctx!.createGain();
      gainNode.gain.setValueAtTime(0, chordTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.15, chordTime + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, chordTime + duration);
      gainNode.connect(this.ctx!.destination);

      notes.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        osc.type = w.type;
        osc.frequency.setValueAtTime(freq, chordTime);
        osc.connect(gainNode);
        osc.start(chordTime);
        osc.stop(chordTime + duration);
      });
    });
  }
  // ─── Delight cues (theme-independent flourishes) ─────────────────────────

  /** Plays a sequence of short notes at absolute offsets (seconds). */
  private playNotes(
    notes: { freq: number; at: number; dur: number }[],
    type: OscillatorType,
    gainScale = 1,
  ) {
    this.initCtx();
    if (!this.ctx || this.muted || this.volume <= 0) return;
    const now = this.ctx.currentTime;
    notes.forEach((n) => {
      const gainNode = this.ctx!.createGain();
      gainNode.gain.setValueAtTime(0, now + n.at);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.18 * gainScale, now + n.at + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + n.at + n.dur);
      gainNode.connect(this.ctx!.destination);
      const osc = this.ctx!.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(n.freq, now + n.at);
      osc.connect(gainNode);
      osc.start(now + n.at);
      osc.stop(now + n.at + n.dur);
    });
  }

  /** A single pitch sweep, used for whooshes and soft thuds. */
  private playSweep(type: OscillatorType, startFreq: number, endFreq: number, dur: number, gainScale = 1) {
    this.initCtx();
    if (!this.ctx || this.muted || this.volume <= 0) return;
    const now = this.ctx.currentTime;
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(this.volume * 0.16 * gainScale, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    gainNode.connect(this.ctx.destination);
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + dur);
  }

  /** Subtle UI tick for buttons and toggles. */
  playClick() {
    this.playSweep("square", 1200, 700, 0.04, 0.7);
  }

  /** Airy sweep when a tile flies open or a panel slides in. */
  playWhoosh() {
    this.playSweep("triangle", 760, 220, 0.18, 0.8);
  }

  /** Sparkly chime when something is revealed or discovered. */
  playDiscover() {
    this.playNotes(
      [
        { freq: 660, at: 0, dur: 0.12 },
        { freq: 990, at: 0.08, dur: 0.16 },
        { freq: 1320, at: 0.16, dur: 0.2 },
      ],
      "sine",
      1,
    );
  }

  /** Bright rising arpeggio for a hot streak. */
  playStreak() {
    this.playNotes(
      [
        { freq: 523.25, at: 0, dur: 0.1 },
        { freq: 659.25, at: 0.07, dur: 0.1 },
        { freq: 783.99, at: 0.14, dur: 0.1 },
        { freq: 1046.5, at: 0.21, dur: 0.22 },
      ],
      "triangle",
      1,
    );
  }

  /** Coin-like ding for a score gain. */
  playScoreUp() {
    this.playNotes(
      [
        { freq: 880, at: 0, dur: 0.06 },
        { freq: 1318.51, at: 0.05, dur: 0.18 },
      ],
      "square",
      0.8,
    );
  }

  /** Soft low thud for a score loss. */
  playScoreDown() {
    this.playSweep("triangle", 320, 120, 0.22, 0.9);
  }

  /** Bright major stab for a clutch / game-winning moment. */
  playClutch() {
    this.playNotes(
      [
        { freq: 659.25, at: 0, dur: 0.1 },
        { freq: 987.77, at: 0.06, dur: 0.1 },
        { freq: 1318.51, at: 0.12, dur: 0.12 },
        { freq: 1760, at: 0.2, dur: 0.26 },
      ],
      "sine",
      1,
    );
  }

  /** Mini fanfare for a comeback. */
  playComeback() {
    this.playNotes(
      [
        { freq: 523.25, at: 0, dur: 0.12 },
        { freq: 783.99, at: 0.12, dur: 0.12 },
        { freq: 1046.5, at: 0.24, dur: 0.3 },
      ],
      "triangle",
      1,
    );
  }

  /** Playful two-step chime for a discovered secret. */
  playEgg() {
    this.playNotes(
      [
        { freq: 587.33, at: 0, dur: 0.1 },
        { freq: 880, at: 0.1, dur: 0.1 },
        { freq: 587.33, at: 0.2, dur: 0.1 },
        { freq: 1174.66, at: 0.3, dur: 0.24 },
      ],
      "sine",
      1,
    );
  }

  /** Comedic descending "wah" for a wrong turn / funny moment. */
  playWobble() {
    this.playSweep("sawtooth", 380, 90, 0.35, 0.8);
  }
}

export const soundManager = new SoundManager();