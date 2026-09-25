/** Меню: заставка и выбор уровня с рекордами из localStorage. */

import Phaser from 'phaser';
import { getPalette } from '../config/palettes';
import { LEVELS, LEVEL_CARDS, UNLOCK_ALL_LEVELS } from '../levels';
import { audio } from '../systems/AudioManager';
import { Fx } from '../systems/Fx';
import { Save } from '../systems/Save';
import { VIEW_H, onWidthChange } from '../systems/Textures';

const FONT = '"Baloo 2", Nunito, sans-serif';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    // разметка считается от ширины экрана — при её смене проще собрать сцену заново
    onWidthChange(this, () => this.scene.restart());

    const palette = getPalette('yard');

    this.add.image(0, 0, 'yard-sky').setOrigin(0).setDisplaySize(this.scale.width, VIEW_H);
    this.add.tileSprite(0, VIEW_H - 440, this.scale.width, 340, 'yard-far')
      .setOrigin(0).setAlpha(0.7);
    this.add.tileSprite(0, VIEW_H - 240, this.scale.width, 240, 'yard-near').setOrigin(0);

    new Fx(this, palette).ambient();

    const title = this.add.text(this.scale.width / 2, 150, 'SUPER MASHIO', {
      fontFamily: FONT, fontSize: '78px', color: '#ffd166',
    }).setOrigin(0.5);
    title.setShadow(0, 6, '#2a1b3d', 12, true, true);
    this.tweens.add({
      targets: title,
      scaleX: 1.03,
      scaleY: 1.05,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(this.scale.width / 2, 214, 'собери корм и накорми кошку', {
      fontFamily: FONT, fontSize: '24px', color: '#f6ead8',
    }).setOrigin(0.5).setAlpha(0.85);

    const save = Save.all();
    for (const [i, card] of LEVEL_CARDS.entries()) {
      this.levelCard(this.scale.width / 2 + (i - 1) * 300, 420, card,
        UNLOCK_ALL_LEVELS || save.unlocked >= card.id);
    }

    this.add.text(this.scale.width / 2, VIEW_H - 46,
      '←→ / A D — бег · Space — прыжок (двойной) · Shift — рывок', {
        fontFamily: FONT, fontSize: '19px', color: '#e6dcc9',
      }).setOrigin(0.5).setAlpha(0.7);

    this.input.once('pointerdown', () => audio.unlock());
    this.input.keyboard!.once('keydown', () => audio.unlock());
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private levelCard(x: number, y: number,
                    card: { id: number; name: string; cat: string; palette: string },
                    unlocked: boolean): void {
    const ready = LEVELS[card.id] !== undefined;
    const palette = getPalette(card.palette);
    const available = unlocked && ready;

    const container = this.add.container(x, y);
    const panel = this.add.graphics();
    panel.fillStyle(0x1b1430, 0.55);
    panel.fillRoundedRect(-125, -110, 250, 220, 24);
    panel.lineStyle(3, palette.accent, available ? 0.8 : 0.25);
    panel.strokeRoundedRect(-125, -110, 250, 220, 24);
    container.add(panel);

    const swatch = this.add.graphics();
    swatch.fillStyle(palette.sky[1], 1);
    swatch.fillRoundedRect(-104, -90, 208, 96, 16);
    swatch.fillStyle(palette.ground, 1);
    swatch.fillRoundedRect(-104, -32, 208, 38, 12);
    container.add(swatch);

    container.add(this.add.text(0, 30, card.name, {
      fontFamily: FONT, fontSize: '30px', color: '#ffffff',
    }).setOrigin(0.5));

    container.add(this.add.text(0, 62, available ? card.cat : 'скоро', {
      fontFamily: FONT, fontSize: '20px', color: '#e6dcc9',
    }).setOrigin(0.5).setAlpha(0.8));

    const result = Save.result(card.id);
    for (let s = 0; s < 3; s++) {
      container.add(this.add.image(-30 + s * 30, 92, 'spark')
        .setScale(0.6)
        .setTint(s < result.stars ? palette.accent : 0xffffff)
        .setAlpha(s < result.stars ? 1 : 0.22));
    }
    if (result.best > 0) {
      container.add(this.add.text(96, -96, String(result.best), {
        fontFamily: FONT, fontSize: '20px', color: '#ffd166',
      }).setOrigin(1, 0));
    }

    if (!available) {
      container.setAlpha(0.55);
      return;
    }

    panel.setInteractive(new Phaser.Geom.Rectangle(-125, -110, 250, 220),
      Phaser.Geom.Rectangle.Contains);
    panel.on('pointerover', () => this.tweens.add({ targets: container, scale: 1.05, duration: 140 }));
    panel.on('pointerout', () => this.tweens.add({ targets: container, scale: 1, duration: 140 }));
    panel.on('pointerdown', () => {
      audio.unlock();
      audio.collect(2);
      this.cameras.main.fadeOut(320, 0, 0, 0);
      this.time.delayedCall(340, () => this.scene.start('game', { level: card.id }));
    });
  }
}
