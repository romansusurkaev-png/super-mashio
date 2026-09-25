/**
 * Звук целиком синтезируется через Web Audio — готовых сэмплов в проекте нет,
 * а тишина в платформере хуже простых звуков.
 *
 * Браузер не даёт запустить звук до первого касания или клика,
 * поэтому unlock() зовётся из первого пользовательского ввода.
 */

import { Save } from './Save';

type Wave = OscillatorType;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private muted = Save.isMuted();

  // ------------------------------------------------------------ базовое

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.24;
    this.musicGain.connect(this.master);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    Save.setMuted(this.muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  /** Один тон с мягкой огибающей; to — куда «съезжает» частота */
  private tone(freq: number, dur: number, opts: {
    type?: Wave; gain?: number; to?: number; delay?: number; dest?: GainNode | null;
  } = {}): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);

    const peak = opts.gain ?? 0.3;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, dur * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(env);
    env.connect(opts.dest ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Короткий шум — шаги, приземление, удар */
  private noise(dur: number, gain: number, cutoff: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start(t);
  }

  // ------------------------------------------------------------ игровые звуки

  jump(): void {
    this.tone(330, 0.16, { to: 620, gain: 0.24, type: 'triangle' });
  }

  doubleJump(): void {
    this.tone(440, 0.18, { to: 880, gain: 0.2, type: 'sine' });
    this.tone(660, 0.12, { to: 990, gain: 0.1, type: 'sine', delay: 0.04 });
  }

  land(strength = 0.5): void {
    this.noise(0.14, 0.12 + strength * 0.18, 900);
    this.tone(120, 0.1, { to: 70, gain: 0.16, type: 'sine' });
  }

  /** Сбор корма: чем длиннее серия, тем выше нота */
  collect(streak = 0): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880];
    const note = scale[Math.min(streak, scale.length - 1)];
    this.tone(note, 0.14, { gain: 0.22, type: 'triangle' });
    this.tone(note * 2, 0.09, { gain: 0.09, type: 'sine', delay: 0.02 });
  }

  /** Крупная добыча — консерва и золотая рыбка */
  treasure(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, 0.22, { gain: 0.18, type: 'triangle', delay: i * 0.07 }));
  }

  hit(): void {
    this.noise(0.2, 0.24, 1400);
    this.tone(220, 0.22, { to: 90, gain: 0.22, type: 'sawtooth' });
  }

  dash(): void {
    this.noise(0.22, 0.16, 2600);
    this.tone(760, 0.2, { to: 300, gain: 0.12, type: 'sine' });
  }

  /** Мяу: две скользящие ноты, вторая ниже — так слышится «мя-ау» */
  meow(): void {
    this.tone(620, 0.16, { to: 780, gain: 0.2, type: 'sawtooth' });
    this.tone(760, 0.3, { to: 430, gain: 0.18, type: 'sawtooth', delay: 0.14 });
  }

  /** Мурчание: низкое дрожание */
  purr(times = 6): void {
    for (let i = 0; i < times; i++) {
      this.tone(70, 0.12, { to: 58, gain: 0.16, type: 'sawtooth', delay: i * 0.14 });
    }
  }

  /** Сыплющиеся крокеты */
  pour(): void {
    for (let i = 0; i < 14; i++) {
      this.noise(0.05, 0.07, 5200, i * 0.07 + Math.random() * 0.03);
    }
  }

  star(index: number): void {
    this.tone(660 + index * 220, 0.3, { gain: 0.22, type: 'triangle' });
    this.tone(990 + index * 220, 0.24, { gain: 0.1, type: 'sine', delay: 0.05 });
  }

  // ------------------------------------------------------------ фоновая мелодия

  /**
   * Простая пентатоника: бас на каждую долю и мелодия сверху.
   * Фраза планируется целиком, следующая ставится по таймеру.
   */
  startMusic(): void {
    if (!this.ctx || !this.musicGain || this.musicTimer !== null) return;

    const bpm = 96;
    const beat = 60 / bpm;
    const bass = [130.81, 130.81, 174.61, 164.81];
    const lead = [523.25, 587.33, 659.25, 587.33, 523.25, 440, 493.88, 523.25];

    const phrase = () => {
      for (let i = 0; i < 4; i++) {
        this.tone(bass[i], beat * 0.9, {
          type: 'sine', gain: 0.22, delay: i * beat * 2, dest: this.musicGain,
        });
      }
      for (let i = 0; i < lead.length; i++) {
        if (Math.random() < 0.2) continue; // пара пропусков, чтобы не долбило одинаково
        this.tone(lead[i], beat * 0.7, {
          type: 'triangle', gain: 0.14, delay: i * beat, dest: this.musicGain,
        });
      }
    };

    phrase();
    this.musicTimer = window.setInterval(phrase, beat * 8 * 1000);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

/** Один менеджер на всю игру */
export const audio = new AudioManager();
