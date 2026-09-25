/** Итог уровня: три звезды, оценка от кошки и кнопки. */

import Phaser from 'phaser';
import { getPalette } from '../config/palettes';
import { LEVELS } from '../levels';
import { audio } from '../systems/AudioManager';
import { VIEW_H, VIEW_W } from '../systems/Textures';

const FONT = '"Baloo 2", Nunito, sans-serif';

const VERDICT = [
  'кошка смотрит с укором',
  'кошка требует добавки',
  'кошка довольна',
  'кошка наелась',
];

interface ResultData {
  level: number;
  name: string;
  catName: string;
  score: number;
  stars: number;
  palette: string;
}

export class ResultScene extends Phaser.Scene {
  private result!: ResultData;

  constructor() {
    super('result');
  }

  init(data: ResultData): void {
    this.result = data;
  }

  create(): void {
    const palette = getPalette(this.result.palette);

    this.add.image(0, 0, `${this.result.palette}-sky`).setOrigin(0).setDisplaySize(VIEW_W, VIEW_H);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x120c1e, 0.62).setOrigin(0);

    const panel = this.add.graphics();
    panel.fillStyle(0x1b1430, 0.85);
    panel.fillRoundedRect(VIEW_W / 2 - 300, 130, 600, 440, 30);
    panel.lineStyle(3, palette.accent, 0.6);
    panel.strokeRoundedRect(VIEW_W / 2 - 300, 130, 600, 440, 30);

    this.add.text(VIEW_W / 2, 186, `${this.result.name} пройден`, {
      fontFamily: FONT, fontSize: '38px', color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(VIEW_W / 2, 232, `${this.result.catName} накормлен${this.result.catName === 'Тиша' ? 'а' : ''}`, {
      fontFamily: FONT, fontSize: '22px', color: '#e6dcc9',
    }).setOrigin(0.5).setAlpha(0.8);

    // --- звёзды появляются по одной
    const level = LEVELS[this.result.level];
    for (let i = 0; i < 3; i++) {
      const star = this.add.image(VIEW_W / 2 + (i - 1) * 110, 330, 'spark')
        .setScale(0)
        .setTint(i < this.result.stars ? palette.accent : 0xffffff)
        .setAlpha(i < this.result.stars ? 1 : 0.2);

      this.time.delayedCall(400 + i * 320, () => {
        this.tweens.add({
          targets: star,
          scale: i < this.result.stars ? 1.5 : 1.1,
          angle: 360,
          duration: 520,
          ease: 'Back.easeOut',
        });
        if (i < this.result.stars) audio.star(i);
      });

      if (level) {
        this.add.text(VIEW_W / 2 + (i - 1) * 110, 392, String(level.stars[i]), {
          fontFamily: FONT, fontSize: '17px', color: '#ffffff',
        }).setOrigin(0.5).setAlpha(0.4);
      }
    }

    this.time.delayedCall(1500, () => {
      const verdict = this.add.text(VIEW_W / 2, 442, VERDICT[this.result.stars], {
        fontFamily: FONT, fontSize: '30px', color: `#${palette.accent.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: verdict, alpha: 1, y: 436, duration: 420 });
      audio.purr(4);
    });

    this.add.text(VIEW_W / 2, 486, `собрано корма: ${this.result.score}`, {
      fontFamily: FONT, fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.75);

    this.button(VIEW_W / 2 - 110, 534, 'Ещё раз', palette.accent,
      () => this.scene.start('game', { level: this.result.level }));
    this.button(VIEW_W / 2 + 110, 534, 'В меню', 0xffffff,
      () => this.scene.start('menu'));

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private button(x: number, y: number, label: string, color: number, onClick: () => void): void {
    const text = this.add.text(x, y, label, {
      fontFamily: FONT, fontSize: '26px', color: '#1b1430',
      backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
      padding: { x: 22, y: 9 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', () => text.setScale(1.07));
    text.on('pointerout', () => text.setScale(1));
    text.on('pointerdown', () => {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.time.delayedCall(300, onClick);
    });
  }
}
