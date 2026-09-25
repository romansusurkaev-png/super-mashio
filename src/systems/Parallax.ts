/** Параллакс: небо + три слоя, каждый едет со своей скоростью. */

import Phaser from 'phaser';
import type { Palette } from '../config/palettes';
import { MAX_VIEW_W, VIEW_H } from './Textures';

interface Layer {
  sprite: Phaser.GameObjects.TileSprite;
  factor: number;
}

export class Parallax {
  private readonly layers: Layer[] = [];
  private readonly sky: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, palette: Palette, prefix: string) {
    // небо тянем точно по ширине экрана (в нём зарево), а слои с запасом — их просто видно больше
    this.sky = scene.add.image(0, 0, `${prefix}-sky`)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100)
      .setDisplaySize(scene.scale.width, VIEW_H);

    const add = (key: string, height: number, bottom: number, factor: number,
                 depth: number, alpha: number, tint?: number) => {
      const sprite = scene.add.tileSprite(0, bottom - height, MAX_VIEW_W, height, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(depth)
        .setAlpha(alpha);
      if (tint !== undefined) sprite.setTint(tint);
      this.layers.push({ sprite, factor });
    };

    add(`${prefix}-far`, 340, VIEW_H - 100, 0.12, -90, 0.75);
    add(`${prefix}-mid`, 300, VIEW_H - 70, 0.3, -80, 0.9);
    add(`${prefix}-near`, 240, VIEW_H - 40, 0.58, -70, 1);

    void palette;
  }

  layout(width: number): void {
    this.sky.setDisplaySize(width, VIEW_H);
  }

  update(scrollX: number): void {
    for (const layer of this.layers) {
      layer.sprite.tilePositionX = scrollX * layer.factor;
    }
  }
}
