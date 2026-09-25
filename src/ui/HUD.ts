/** HUD: счётчик корма, название уровня, прогресс до звёзд, кнопки звука и паузы. */

import Phaser from 'phaser';
import type { Palette } from '../config/palettes';
import type { LevelDef } from '../levels/types';
import { SVG_SCALE } from '../systems/Textures';

const FONT = '"Baloo 2", Nunito, sans-serif';

/** масштаб иконки корма в счётчике */
const ICON_SCALE = SVG_SCALE * 0.9;

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly palette: Palette;
  private readonly level: LevelDef;

  private readonly icon: Phaser.GameObjects.Image;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly starIcons: Phaser.GameObjects.Image[] = [];
  private readonly soundButton: Phaser.GameObjects.Text;
  private readonly pauseButton: Phaser.GameObjects.Text;
  private readonly rightPanel: Phaser.GameObjects.Graphics;
  private readonly titlePanel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;

  onMute?: () => boolean;
  onPause?: () => void;

  constructor(scene: Phaser.Scene, level: LevelDef, palette: Palette, muted: boolean) {
    this.scene = scene;
    this.palette = palette;
    this.level = level;

    const panel = scene.add.graphics().setScrollFactor(0).setDepth(100);
    panel.fillStyle(0x1b1430, 0.42);
    panel.fillRoundedRect(18, 16, 268, 76, 20);

    // правая панель и заголовок рисуются от своей точки привязки — layout() их двигает
    this.rightPanel = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.rightPanel.fillStyle(0x1b1430, 0.42);
    this.rightPanel.fillRoundedRect(-150, 16, 132, 56, 18);
    this.titlePanel = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.titlePanel.fillStyle(0x1b1430, 0.42);
    this.titlePanel.fillRoundedRect(-130, 16, 260, 44, 16);

    this.icon = scene.add.image(56, 46, 'food-dry')
      .setScrollFactor(0).setDepth(101).setScale(ICON_SCALE);

    this.counter = scene.add.text(84, 24, '0', {
      fontFamily: FONT, fontSize: '34px', color: '#ffffff',
    }).setScrollFactor(0).setDepth(101);

    this.title = scene.add.text(0, 38, `${level.name} · ${level.catName}`, {
      fontFamily: FONT, fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.9);

    // полоска прогресса до трёх звёзд
    scene.add.rectangle(88, 74, 180, 8, 0xffffff, 0.18)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.barFill = scene.add.rectangle(88, 74, 0, 8, palette.accent)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    for (let i = 0; i < 3; i++) {
      const star = scene.add.image(196 + i * 26, 74, 'spark')
        .setScrollFactor(0).setDepth(103).setScale(0.55).setAlpha(0.25);
      this.starIcons.push(star);
    }

    this.soundButton = this.button(0, 44, muted ? '🔇' : '🔊', () => {
      const nowMuted = this.onMute?.() ?? false;
      this.soundButton.setText(nowMuted ? '🔇' : '🔊');
    });
    this.pauseButton = this.button(0, 44, '⏸', () => this.onPause?.());

    this.layout(scene.scale.width);
  }

  /** Раскладывает то, что привязано к правому краю и к центру экрана */
  layout(width: number): void {
    this.rightPanel.x = width;
    this.soundButton.x = width - 118;
    this.pauseButton.x = width - 52;
    this.titlePanel.x = width / 2;
    this.title.x = width / 2;
  }

  private button(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, label, { fontFamily: FONT, fontSize: '26px' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });
    text.on('pointerover', () => text.setScale(1.15));
    text.on('pointerout', () => text.setScale(1));
    text.on('pointerdown', onClick);
    return text;
  }

  setScore(score: number): void {
    this.counter.setText(String(score));
    const max = this.level.stars[2];
    this.barFill.width = Phaser.Math.Clamp(score / max, 0, 1) * 180;

    for (let i = 0; i < 3; i++) {
      const earned = score >= this.level.stars[i];
      this.starIcons[i].setAlpha(earned ? 1 : 0.25);
      this.starIcons[i].setTint(earned ? this.palette.accent : 0xffffff);
    }
  }

  /** Пружинка на счётчике, когда прилетел корм. Масштабы у текста и иконки разные,
   *  поэтому твины отдельные — иначе иконка прыгнула бы к чужому размеру. */
  pulse(): void {
    this.scene.tweens.add({
      targets: this.counter,
      scaleX: 1.22, scaleY: 1.22,
      duration: 110, yoyo: true, ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.icon,
      scaleX: ICON_SCALE * 1.22, scaleY: ICON_SCALE * 1.22,
      duration: 110, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  /** Куда лететь собранному предмету — в мировых координатах */
  targetWorldPoint(): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    return { x: cam.scrollX + this.icon.x, y: cam.scrollY + this.icon.y };
  }
}
