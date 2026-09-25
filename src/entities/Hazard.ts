/**
 * Опасности. Игра добрая: при касании персонаж не умирает,
 * а теряет часть собранного корма и отлетает в сторону.
 */

import Phaser from 'phaser';
import type { HazardDef, HazardType } from '../levels/types';
import { SVG_SCALE } from '../systems/Textures';

/** Сколько корма теряется и как сильно отбрасывает */
export const HAZARD_COST: Record<HazardType, { food: number; knock: number }> = {
  puddle: { food: 3, knock: 260 },
  vacuum: { food: 6, knock: 380 },
  yarn: { food: 4, knock: 340 },
  icicle: { food: 5, knock: 300 },
};

export class Hazard {
  readonly type: HazardType;
  readonly sprite: Phaser.Physics.Arcade.Image;
  private readonly def: HazardDef;
  private dir = 1;
  private phase = Math.random() * Math.PI * 2;
  private homeY: number;

  constructor(scene: Phaser.Scene, def: HazardDef) {
    this.type = def.type;
    this.def = def;

    this.sprite = scene.physics.add.image(def.x, def.y, this.textureFor(def.type));
    this.sprite.setDepth(def.type === 'puddle' ? 3 : 7);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.sprite.setImmovable(true);
    this.sprite.setData('hazard', this);

    // хитбоксы задаём в мировых пикселях и делим на масштаб спрайта:
    // Arcade умножает размер тела на scale, а думать удобнее в экранных размерах
    const fit = (worldW: number, worldH: number) => {
      body.setSize(worldW / this.sprite.scaleX, worldH / this.sprite.scaleY, true);
    };

    switch (def.type) {
      case 'puddle': {
        const width = def.w ?? 170;
        this.sprite.setDisplaySize(width, width * 0.28);
        this.sprite.setOrigin(0.5, 0.9);
        fit(width * 0.9, 26);
        // рябь
        scene.tweens.add({
          targets: this.sprite,
          scaleX: this.sprite.scaleX * 1.04,
          duration: 1600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      }
      case 'vacuum':
        this.sprite.setScale(SVG_SCALE * 0.95);
        this.sprite.setOrigin(0.5, 1);
        fit(96, 46);
        break;
      case 'yarn':
        this.sprite.setScale(SVG_SCALE * 0.9);
        this.sprite.setOrigin(0.5, 1);
        fit(66, 66);
        break;
      case 'icicle':
        this.sprite.setScale(SVG_SCALE);
        this.sprite.setOrigin(0.5, 0);
        fit(28, 92);
        break;
    }

    this.homeY = this.sprite.y;
  }

  private textureFor(type: HazardType): string {
    return type;
  }

  update(delta: number, playerX: number): void {
    const dt = delta / 1000;
    this.phase += dt * 4;

    switch (this.type) {
      case 'vacuum': {
        const from = this.def.from ?? this.def.x - 200;
        const to = this.def.to ?? this.def.x + 200;
        const speed = this.def.speed ?? 90;
        this.sprite.x += this.dir * speed * dt;
        if (this.sprite.x >= to) { this.sprite.x = to; this.dir = -1; }
        if (this.sprite.x <= from) { this.sprite.x = from; this.dir = 1; }
        this.sprite.setFlipX(this.dir < 0);
        this.sprite.y = this.homeY + Math.sin(this.phase * 0.7) * 2;
        break;
      }
      case 'yarn': {
        const from = this.def.from ?? this.def.x - 200;
        const to = this.def.to ?? this.def.x + 200;
        const speed = this.def.speed ?? 150;
        this.sprite.x += this.dir * speed * dt;
        if (this.sprite.x >= to) { this.sprite.x = to; this.dir = -1; }
        if (this.sprite.x <= from) { this.sprite.x = from; this.dir = 1; }
        // катится: угол пропорционален пройденному пути
        this.sprite.angle += (this.dir * speed * dt) / 33 * (180 / Math.PI);
        this.sprite.y = this.homeY - Math.abs(Math.sin(this.phase)) * 3;
        break;
      }
      case 'icicle': {
        // висит, пока игрок не подойдёт; потом падает и через паузу возвращается
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        if (!body.allowGravity && Math.abs(playerX - this.sprite.x) < 90) {
          body.setAllowGravity(true);
          this.sprite.scene.tweens.add({
            targets: this.sprite, angle: { from: -3, to: 3 }, duration: 60, repeat: 2,
          });
        }
        if (this.sprite.y > this.homeY + 620) {
          body.setAllowGravity(false);
          body.setVelocity(0, 0);
          this.sprite.setPosition(this.def.x, this.homeY);
        }
        break;
      }
      case 'puddle':
        break;
    }
  }

  get cost(): { food: number; knock: number } {
    return HAZARD_COST[this.type];
  }
}
