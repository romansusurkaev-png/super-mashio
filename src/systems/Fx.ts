/** Пыль, искры, сердечки, светлячки и тряска камеры — вся мелочь, которая делает картинку живой. */

import Phaser from 'phaser';
import type { Palette } from '../config/palettes';
import { SVG_SCALE, VIEW_H, VIEW_W, mix } from './Textures';

export class Fx {
  private readonly scene: Phaser.Scene;
  private readonly palette: Palette;

  constructor(scene: Phaser.Scene, palette: Palette) {
    this.scene = scene;
    this.palette = palette;
  }

  /** Пыль из-под ног: при приземлении и на резком развороте */
  dust(x: number, y: number, strength = 0.5, dir = 0): void {
    const emitter = this.scene.add.particles(x, y, 'soft-dot', {
      speed: { min: 30, max: 90 + strength * 140 },
      angle: dir === 0 ? { min: 200, max: 340 } : (dir > 0 ? { min: 170, max: 215 } : { min: -35, max: 10 }),
      lifespan: { min: 220, max: 480 },
      scale: { start: 0.28 + strength * 0.2, end: 0 },
      alpha: { start: 0.5, end: 0 },
      gravityY: -60,
      tint: mix(this.palette.groundTop, 0xffffff, 0.55),
      quantity: 4 + Math.round(strength * 8),
      emitting: false,
    });
    emitter.setDepth(4);
    emitter.explode();
    this.scene.time.delayedCall(700, () => emitter.destroy());
  }

  /** Шлейф частиц за рывком */
  dashTrail(x: number, y: number, dir: number): void {
    const emitter = this.scene.add.particles(x, y - 50, 'soft-dot', {
      speed: { min: 40, max: 160 },
      angle: dir > 0 ? { min: 160, max: 200 } : { min: -20, max: 20 },
      lifespan: 300,
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.55, end: 0 },
      tint: [0x9ad9ff, this.palette.accent],
      quantity: 12,
      emitting: false,
    });
    emitter.setDepth(4);
    emitter.explode();
    this.scene.time.delayedCall(500, () => emitter.destroy());
  }

  /** Искры на месте собранного предмета */
  collectBurst(x: number, y: number, tint: number): void {
    const emitter = this.scene.add.particles(x, y, 'spark', {
      speed: { min: 60, max: 210 },
      lifespan: { min: 260, max: 520 },
      scale: { start: 0.5, end: 0 },
      rotate: { start: 0, end: 220 },
      alpha: { start: 1, end: 0 },
      tint: [tint, 0xffffff],
      quantity: 12,
      emitting: false,
    });
    emitter.setDepth(30);
    emitter.explode();
    this.scene.time.delayedCall(700, () => emitter.destroy());
  }

  /** Удар об опасность: рассыпается часть корма */
  hitBurst(x: number, y: number, count: number): void {
    const emitter = this.scene.add.particles(x, y - 50, 'kibble', {
      speed: { min: 90, max: 300 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 1, end: 0.7 },
      alpha: { start: 1, end: 0 },
      gravityY: 900,
      rotate: { min: -180, max: 180 },
      quantity: Math.min(24, 4 + count),
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode();
    this.scene.time.delayedCall(1100, () => emitter.destroy());
  }

  /** Корм сыплется в миску */
  pourFood(x: number, y: number, durationMs: number): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(x, y, 'kibble', {
      speed: { min: 20, max: 90 },
      angle: { min: 250, max: 290 },
      lifespan: 900,
      scale: { start: 1.1, end: 0.9 },
      gravityY: 1400,
      rotate: { min: -180, max: 180 },
      frequency: 18,
      quantity: 2,
    });
    emitter.setDepth(12);
    this.scene.time.delayedCall(durationMs, () => {
      emitter.stop();
      this.scene.time.delayedCall(1000, () => emitter.destroy());
    });
    return emitter;
  }

  /** Сердечки и «мурр»-волны над сытой кошкой */
  hearts(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 260, () => {
        const heart = this.scene.add.image(x + Phaser.Math.Between(-30, 30), y, 'heart')
          .setScale(0)
          .setDepth(30);
        this.scene.tweens.add({
          targets: heart,
          scale: Phaser.Math.FloatBetween(0.5, 0.85) * SVG_SCALE,
          y: y - Phaser.Math.Between(90, 160),
          x: heart.x + Phaser.Math.Between(-40, 40),
          alpha: { from: 1, to: 0 },
          angle: Phaser.Math.Between(-20, 20),
          duration: 1500,
          ease: 'Sine.easeOut',
          onComplete: () => heart.destroy(),
        });
      });
    }
  }

  /** Расходящаяся волна — «мурр» */
  purrWave(x: number, y: number): void {
    const ring = this.scene.add.circle(x, y, 14, 0xffffff, 0)
      .setStrokeStyle(4, this.palette.accent, 0.7)
      .setDepth(29);
    this.scene.tweens.add({
      targets: ring,
      radius: 90,
      alpha: 0,
      duration: 1200,
      ease: 'Sine.easeOut',
      onUpdate: () => ring.setRadius(ring.radius),
      onComplete: () => ring.destroy(),
    });
  }

  /** Светлячки / пылинки / пух — то, что висит в воздухе весь уровень */
  ambient(): Phaser.GameObjects.Particles.ParticleEmitter {
    const kind = this.palette.ambient;
    const peak = kind === 'fireflies' ? 0.9 : 0.35;
    const emitter = this.scene.add.particles(0, 0, 'soft-dot', {
      x: { min: 0, max: VIEW_W },
      y: { min: 40, max: VIEW_H - 60 },
      speedX: kind === 'feathers' ? { min: -40, max: -8 } : { min: -14, max: 14 },
      speedY: kind === 'fireflies' ? { min: -16, max: 16 } : { min: 8, max: 30 },
      lifespan: kind === 'fireflies' ? 4200 : 6000,
      scale: { min: 0.08, max: kind === 'fireflies' ? 0.28 : 0.16 },
      // разгорается и гаснет: альфа идёт синусом за время жизни частицы
      alpha: { onUpdate: (_p, _key, t) => Math.sin(t * Math.PI) * peak },
      tint: this.palette.motes,
      frequency: kind === 'dust' ? 160 : 90,
      blendMode: 'ADD',
    });
    emitter.setScrollFactor(0);
    emitter.setDepth(-10);
    return emitter;
  }

  /** Тряска камеры при ударе */
  shake(intensity = 0.008, duration = 180): void {
    this.scene.cameras.main.shake(duration, intensity);
  }
}
