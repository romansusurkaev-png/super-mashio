/**
 * Финал уровня: кошка замечает игрока, бежит навстречу, трётся о ногу,
 * корм высыпается в миску, кошка ест, наедается, садится и умывается.
 *
 * Вынесено отдельно от GameScene, чтобы хореографию можно было крутить,
 * не трогая геймплей. Порядок и паузы читаются сверху вниз.
 */

import Phaser from 'phaser';
import type { Palette } from '../config/palettes';
import { Cat } from '../entities/Cat';
import type { Player } from '../entities/Player';
import { audio } from './AudioManager';
import type { Fx } from './Fx';

export interface FinaleParts {
  scene: Phaser.Scene;
  player: Player;
  cat: Cat;
  bowl: Phaser.GameObjects.Image;
  fx: Fx;
  palette: Palette;
  /** сколько корма несёт игрок; функция, потому что счётчик тикает по ходу */
  getScore: () => number;
  setScore: (value: number) => void;
}

export class Finale {
  private readonly p: FinaleParts;
  private pile?: Phaser.GameObjects.Ellipse;

  constructor(parts: FinaleParts) {
    this.p = parts;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.p.scene.time.delayedCall(ms, resolve));
  }

  async play(): Promise<void> {
    const { scene, player, cat, bowl, fx } = this.p;
    const cam = scene.cameras.main;

    // камера мягко подъезжает к миске
    cam.stopFollow();
    cam.pan(bowl.x - 60, bowl.y - 180, 900, 'Sine.easeInOut');
    cam.zoomTo(1.35, 1100, 'Sine.easeInOut');
    await this.wait(700);

    // --- кошка заметила
    audio.meow();
    cat.notice();
    await this.wait(500);

    // --- бежит навстречу
    cat.runTo(player.x + 70 * (cat.x > player.x ? 1 : -1), 300);
    await this.wait(Math.min(1600, (Math.abs(cat.x - player.x) / 300) * 1000 + 200));

    // --- трётся о ногу, игрок наклоняется погладить
    scene.tweens.add({ targets: player, extraTilt: -7, duration: 500, ease: 'Sine.easeOut' });
    cat.rub(1500);
    audio.purr(4);
    await this.wait(1600);
    scene.tweens.add({ targets: player, extraTilt: 0, duration: 400 });

    // --- игрок подходит к миске и высыпает корм
    await this.movePlayerTo(bowl.x - 90);
    scene.tweens.add({ targets: player, extraTilt: -10, duration: 400, ease: 'Sine.easeOut' });
    cat.setFacing(-1);

    const total = this.p.getScore();
    const pourMs = Phaser.Math.Clamp(total * 22, 900, 2600);
    fx.pourFood(bowl.x - 10, bowl.y - 120, pourMs);
    audio.pour();

    // горка корма растёт в миске, счётчик утекает в ноль
    this.pile = scene.add.ellipse(bowl.x, bowl.y - 46, 74, 22, 0xc07c42)
      .setDepth(7).setScale(0, 0);
    scene.tweens.add({ targets: this.pile, scaleX: 1, scaleY: 1, duration: pourMs, ease: 'Sine.easeOut' });
    scene.tweens.addCounter({
      from: total,
      to: 0,
      duration: pourMs,
      onUpdate: (t) => this.p.setScore(Math.round(t.getValue() ?? 0)),
    });
    await this.wait(pourMs + 250);
    scene.tweens.add({ targets: player, extraTilt: -4, duration: 400 });

    // --- кошка ест
    cat.runTo(bowl.x - 40, 220);
    await this.wait(700);
    cat.setFacing(1);
    cat.startEating();
    for (let i = 0; i < 5; i++) {
      audio.pour();
      await this.wait(520);
    }
    scene.tweens.add({ targets: this.pile, scaleX: 0.15, scaleY: 0.15, duration: 900 });

    // --- наелась: садится, умывается, сердечки
    cat.sit();
    await this.wait(700);
    cat.wash();
    audio.purr(8);
    fx.hearts(cat.x, cat.y - 170);
    for (let i = 0; i < 3; i++) {
      fx.purrWave(cat.x, cat.y - 120);
      await this.wait(420);
    }

    scene.tweens.add({ targets: player, extraTilt: 0, duration: 400 });
    await this.wait(600);
  }

  /** Игрок сам доходит до точки — обычной походкой, а не твином по X */
  private movePlayerTo(x: number): Promise<void> {
    const { player } = this.p;
    if (Math.abs(x - player.x) < 12) return Promise.resolve();
    return new Promise((resolve) => player.walkTo(x, resolve));
  }
}
