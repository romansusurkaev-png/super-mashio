/** Пауза поверх уровня. */

import Phaser from 'phaser';
import { audio } from '../systems/AudioManager';
import { VIEW_H, onWidthChange } from '../systems/Textures';
import type { GameScene } from './GameScene';

const FONT = '"Baloo 2", Nunito, sans-serif';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('pause');
  }

  create(): void {
    // разметка считается от ширины экрана — при её смене проще собрать сцену заново
    onWidthChange(this, () => this.scene.restart());

    this.add.rectangle(0, 0, this.scale.width, VIEW_H, 0x120c1e, 0.6).setOrigin(0);
    this.add.text(this.scale.width / 2, VIEW_H / 2 - 80, 'Пауза', {
      fontFamily: FONT, fontSize: '54px', color: '#ffd166',
    }).setOrigin(0.5);

    this.button(this.scale.width / 2, VIEW_H / 2 + 10, 'Продолжить', () => {
      const game = this.scene.get('game') as GameScene;
      game.resume();
      this.scene.stop();
    });

    this.button(this.scale.width / 2, VIEW_H / 2 + 90, 'В меню', () => {
      audio.stopMusic();
      this.scene.stop('game');
      this.scene.stop();
      this.scene.start('menu');
    });
  }

  private button(x: number, y: number, label: string, onClick: () => void): void {
    const text = this.add.text(x, y, label, {
      fontFamily: FONT, fontSize: '28px', color: '#1b1430',
      backgroundColor: '#ffd166', padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    text.on('pointerover', () => text.setScale(1.06));
    text.on('pointerout', () => text.setScale(1));
    text.on('pointerdown', onClick);
  }
}
