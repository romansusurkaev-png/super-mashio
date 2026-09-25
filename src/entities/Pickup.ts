/** Корм на уровне: подпрыгивает, крутится, а при сборе улетает к счётчику по дуге. */

import Phaser from 'phaser';
import { PICKUP_VALUE, type PickupType } from '../levels/types';
import { SVG_SCALE } from '../systems/Textures';

const TINT: Record<PickupType, number> = {
  dry: 0xe0a268,
  pouch: 0x7fb3a6,
  can: 0xff8a5b,
  fish: 0xffd166,
};

const SCALE: Record<PickupType, number> = {
  dry: 0.75,
  pouch: 0.8,
  can: 0.8,
  fish: 0.9,
};

export class Pickup {
  readonly scene: Phaser.Scene;
  readonly type: PickupType;
  readonly value: number;
  readonly sprite: Phaser.Physics.Arcade.Image;
  private glow?: Phaser.GameObjects.Image;
  private taken = false;

  constructor(scene: Phaser.Scene, x: number, y: number, type: PickupType) {
    this.scene = scene;
    this.type = type;
    this.value = PICKUP_VALUE[type];

    // редкая добыча светится, чтобы её было видно издалека
    if (type === 'fish' || type === 'can') {
      this.glow = scene.add.image(x, y, 'soft-dot')
        .setScale(type === 'fish' ? 2.4 : 1.8)
        .setTint(TINT[type])
        .setAlpha(0.35)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(2);
      scene.tweens.add({
        targets: this.glow,
        alpha: 0.6,
        scale: this.glow.scale * 1.15,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const scale = SCALE[type] * SVG_SCALE;
    this.sprite = scene.physics.add.image(x, y, `food-${type}`);
    this.sprite.setScale(scale);
    this.sprite.setDepth(6);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.sprite.setImmovable(true);
    this.sprite.setData('pickup', this);

    // покачивание вверх-вниз, у каждого своя фаза
    scene.tweens.add({
      targets: this.sprite,
      y: y - 10,
      duration: 1000 + Math.random() * 400,
      delay: Math.random() * 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // «вращение»: сжимаем по X, будто предмет поворачивается к нам ребром
    scene.tweens.add({
      targets: this.sprite,
      scaleX: scale * 0.55,
      duration: 1300,
      delay: Math.random() * 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  get isTaken(): boolean {
    return this.taken;
  }

  get tint(): number {
    return TINT[this.type];
  }

  /**
   * Собрали: предмет подпрыгивает и летит к счётчику по кривой Безье.
   * targetX/targetY — точка счётчика в мировых координатах.
   */
  collect(targetX: number, targetY: number, onArrive: () => void): void {
    if (this.taken) return;
    this.taken = true;

    this.sprite.disableBody(true, false);
    this.glow?.destroy();

    const from = new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
    const to = new Phaser.Math.Vector2(targetX, targetY);
    // управляющая точка выше и в стороне — получается красивая дуга
    const control = new Phaser.Math.Vector2(
      (from.x + to.x) / 2 + Phaser.Math.Between(-60, 60),
      Math.min(from.y, to.y) - 140,
    );
    const curve = new Phaser.Curves.QuadraticBezier(from, control, to);
    const point = new Phaser.Math.Vector2();

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: 'Sine.easeIn',
      onUpdate: (tween) => {
        curve.getPoint(tween.getValue() ?? 0, point);
        this.sprite.setPosition(point.x, point.y);
        this.sprite.setScale(SCALE[this.type] * SVG_SCALE * (1 - 0.55 * (tween.getValue() ?? 0)));
        this.sprite.setAngle((tween.getValue() ?? 0) * 360);
      },
      onComplete: () => {
        onArrive();
        this.sprite.destroy();
      },
    });

    // короткий подскок в начале полёта
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: SCALE[this.type] * SVG_SCALE * 1.4,
      duration: 110,
      yoyo: true,
    });
  }

  destroy(): void {
    this.glow?.destroy();
    this.sprite.destroy();
  }
}
