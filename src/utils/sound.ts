class SoundManager {
  private ctx: AudioContext | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;

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

  updateSettings(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    this.initCtx();
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
    // Low, buzzy square wave detuned chorus
    this.playOscillator('sawtooth', [130, 133], 0.5, { startFreq: 130, endFreq: 110, type: 'linear' }, 10);
  }

  playCorrect() {
    this.initCtx();
    if (!this.ctx || this.muted || this.volume <= 0) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (pleasant arpeggio)
    
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const noteTime = now + idx * 0.08;
      const duration = 0.3;
      
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0, noteTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, noteTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, noteTime + duration);
      gainNode.connect(this.ctx.destination);

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      osc.connect(gainNode);
      
      osc.start(noteTime);
      osc.stop(noteTime + duration);
    });
  }

  playWrong() {
    // Low descending buzzy chord
    this.playOscillator('triangle', [146.83, 110.0], 0.6, { startFreq: 146.83, endFreq: 75.0, type: 'linear' });
  }

  playTimerTick() {
    // High-pitched short woodblock tick
    this.playOscillator('sine', [1000], 0.03);
  }

  playReveal() {
    // Elegant slide up synthesizer chime
    this.playOscillator('triangle', [293.66], 0.4, { startFreq: 293.66, endFreq: 880.00, type: 'exp' });
  }

  playWinner() {
    this.initCtx();
    if (!this.ctx || this.muted || this.volume <= 0) return;

    const now = this.ctx.currentTime;
    // Ascending celebratory fanfare chords
    // Chord 1: C Major (C4, E4, G4, C5)
    // Chord 2: F Major (F4, A4, C5, F5)
    // Chord 3: G Major (G4, B4, D5, G5)
    // Chord 4: C Major high (C5, E5, G5, C6)
    
    const chords = [
      { notes: [261.63, 329.63, 392.00, 523.25], timeOffset: 0.0, duration: 0.2 },
      { notes: [349.23, 440.00, 523.25, 698.46], timeOffset: 0.25, duration: 0.2 },
      { notes: [392.00, 493.88, 587.33, 783.99], timeOffset: 0.5, duration: 0.2 },
      { notes: [523.25, 659.25, 783.99, 1046.50], timeOffset: 0.75, duration: 0.8 }
    ];

    chords.forEach((chord) => {
      const chordTime = now + chord.timeOffset;
      
      const gainNode = this.ctx!.createGain();
      gainNode.gain.setValueAtTime(0, chordTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.15, chordTime + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, chordTime + chord.duration);
      gainNode.connect(this.ctx!.destination);

      chord.notes.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        osc.type = chord.timeOffset > 0.6 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, chordTime);
        osc.connect(gainNode);
        osc.start(chordTime);
        osc.stop(chordTime + chord.duration);
      });
    });
  }
}

export const soundManager = new SoundManager();
