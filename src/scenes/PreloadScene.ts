/**
 * Загрузка ассетов. SVG растеризуем в двойном размере и рисуем вполовину
 * (SVG_SCALE) — иначе обводка мылится, когда канвас растягивается на большой экран.
 */

import Phaser from 'phaser';
import { getPalette } from '../config/palettes';
import { PLAYER_TEXTURE } from '../entities/PlayerAnimations';
import { VIEW_H, VIEW_W, buildLevelTextures, makeParticleTextures, makeVignette } from '../systems/Textures';

/** Натуральные размеры SVG из public/assets/svg */
const SVG: Record<string, [number, number]> = {
  'food-dry': [44, 44],
  'food-pouch': [54, 62],
  'food-can': [60, 54],
  'food-fish': [78, 48],
  bowl: [140, 78],
  'cat-body': [200, 130],
  'cat-head': [140, 130],
  'cat-head-happy': [140, 130],
  'cat-ear': [60, 70],
  'cat-tail': [48, 100],
  'cat-leg': [48, 80],
  vacuum: [120, 62],
  yarn: [88, 88],
  puddle: [200, 56],
  icicle: [44, 110],
  heart: [56, 52],
};

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload(): void {
    this.showProgress();

    this.load.atlas(PLAYER_TEXTURE, 'assets/player/player.png', 'assets/player/player.json');
    this.load.json('player-meta', 'assets/player/player.meta.json');

    for (const [key, [w, h]] of Object.entries(SVG)) {
      this.load.svg(key, `assets/svg/${key}.svg`, { width: w * 2, height: h * 2 });
    }
  }

  create(): void {
    makeParticleTextures(this);
    makeVignette(this);
    // фон уровней рисуем заранее: они процедурные и строятся быстро
    for (const key of ['yard', 'kitchen', 'roofs']) {
      buildLevelTextures(this, getPalette(key), key);
    }
    this.scene.start('menu');
  }

  private showProgress(): void {
    const bg = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, 420, 10, 0xffffff, 0.15);
    const bar = this.add.rectangle(VIEW_W / 2 - 210, VIEW_H / 2, 0, 10, 0xffd166).setOrigin(0, 0.5);
    this.add.text(VIEW_W / 2, VIEW_H / 2 - 44, 'SUPER MASHIO', {
      fontFamily: '"Baloo 2", Nunito, sans-serif', fontSize: '40px', color: '#ffd166',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      bar.width = 420 * value;
    });
    this.load.on('complete', () => {
      bg.destroy();
      bar.destroy();
    });
  }
}
