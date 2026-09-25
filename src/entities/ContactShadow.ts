/**
 * Контактная тень — мягкий эллипс под персонажем.
 * Без неё фото выглядит наклейкой, приклеенной к экрану: тень возвращает вес.
 * В воздухе сжимается и светлеет, показывая высоту.
 */

import Phaser from 'phaser';
import { TUNING } from '../config/tuning';

export class ContactShadow {
  private readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, depth = 0) {
    ContactShadow.ensureTexture(scene);
    this.image = scene.add.image(0, 0, ContactShadow.TEXTURE_KEY);
    this.image.setDepth(depth);
    this.image.setTint(TUNING.shadow.color);
  }

  /**
   * @param x       позиция ног по горизонтали
   * @param groundY уровень пола под персонажем
   * @param height  насколько персонаж сейчас выше пола
   */
  update(x: number, groundY: number, height: number): void {
    const s = TUNING.shadow;
    const t = Phaser.Math.Clamp(height / s.heightFalloff, 0, 1);
    const shrink = Phaser.Math.Linear(1, s.airShrink, t);

    this.image.setPosition(x, groundY + s.offsetY);
    this.image.setDisplaySize(s.radiusX * 2 * shrink, s.radiusY * 2 * shrink);
    this.image.setAlpha(Phaser.Math.Linear(s.alphaGround, s.alphaAir, t));
  }

  setVisible(visible: boolean): void {
    this.image.setVisible(visible);
  }

  destroy(): void {
    this.image.destroy();
  }

  // --- мягкий эллипс рисуем один раз в текстуру, чтобы не жечь Graphics каждый кадр

  private static readonly TEXTURE_KEY = 'contact-shadow';

  private static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(ContactShadow.TEXTURE_KEY)) return;

    const size = 128;
    const canvas = scene.textures.createCanvas(ContactShadow.TEXTURE_KEY, size, size);
    if (!canvas) return;

    const ctx = canvas.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
