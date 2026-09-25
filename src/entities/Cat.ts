/**
 * Кошка. В отличие от игрока она не из фото, а векторная и собрана из частей,
 * которые двигаются как простой скелет: корпус, голова с ушами, четыре лапы,
 * хвост из трёх сегментов.
 *
 * Походка и хвост считаются процедурно от фазы (update), а разовые движения —
 * заметила, потёрлась, села, умывается — обычными твинами.
 */

import Phaser from 'phaser';
import { SVG_SCALE } from '../systems/Textures';

type CatState = 'idle' | 'run' | 'rub' | 'eat' | 'sit' | 'wash';

/** Локальные координаты: 0 по Y — это пол под кошкой, кошка смотрит вправо */
const L = {
  legTopY: -74,
  bodyY: -108,
  /** голова садится на перёд корпуса с нахлёстом, иначе видно «шею» из воздуха */
  headPivot: { x: 62, y: -134 },
  headOffsetY: -30,
  tailRoot: { x: -86, y: -132 },
  backLegX: [-56, -30],
  frontLegX: [34, 60],
};

/** размеры отдельных частей относительно натурального размера SVG */
const EAR_SCALE = SVG_SCALE * 0.85;

/**
 * Хвост: три сегмента, каждый следующий тоньше и короче.
 * Смещение обязано быть меньше высоты предыдущего сегмента,
 * иначе хвост распадается на отдельные палки.
 */
const TAIL = [
  { scale: 1.0, offset: 0 },
  { scale: 0.85, offset: -72 },
  { scale: 0.72, offset: -60 },
];

/** хвост в покое лежит дугой, а не торчит палкой */
const TAIL_REST = [-34, -20, -14];

export class Cat {
  readonly scene: Phaser.Scene;
  readonly root: Phaser.GameObjects.Container;

  private readonly body: Phaser.GameObjects.Image;
  private readonly headPivot: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Image;
  private readonly headHappy: Phaser.GameObjects.Image;
  private readonly ears: Phaser.GameObjects.Image[] = [];
  private readonly backLegs: Phaser.GameObjects.Image[] = [];
  private readonly frontLegs: Phaser.GameObjects.Image[] = [];
  private readonly tail: Phaser.GameObjects.Container[] = [];

  private state: CatState = 'idle';
  private phase = 0;
  private baseScale: number;
  private facing: 1 | -1 = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, scale = 0.32, tint?: number) {
    this.scene = scene;
    this.baseScale = scale;
    this.root = scene.add.container(x, y);
    this.root.setDepth(6);

    // --- хвост: три сегмента цепочкой, каждый крутится вокруг своего основания
    let parent: Phaser.GameObjects.Container = scene.add.container(L.tailRoot.x, L.tailRoot.y);
    this.root.add(parent);
    for (let i = 0; i < TAIL.length; i++) {
      const segment = scene.add.container(0, TAIL[i].offset);
      const image = scene.add.image(0, 0, 'cat-tail').setOrigin(0.5, 1);
      image.setScale(SVG_SCALE * TAIL[i].scale);
      segment.add(image);
      parent.add(segment);
      this.tail.push(segment);
      parent = segment;
    }

    // --- задние лапы (за корпусом)
    for (const lx of L.backLegX) {
      const leg = scene.add.image(lx, L.legTopY, 'cat-leg').setOrigin(0.5, 0.08).setScale(SVG_SCALE);
      leg.setTint(0xd8ccbe);
      this.root.add(leg);
      this.backLegs.push(leg);
    }

    // --- корпус
    this.body = scene.add.image(0, L.bodyY, 'cat-body').setOrigin(0.5, 0.5).setScale(SVG_SCALE);
    this.root.add(this.body);

    // --- передние лапы (перед корпусом)
    for (const lx of L.frontLegX) {
      const leg = scene.add.image(lx, L.legTopY, 'cat-leg').setOrigin(0.5, 0.08).setScale(SVG_SCALE);
      this.root.add(leg);
      this.frontLegs.push(leg);
    }

    // --- голова с ушами
    this.headPivot = scene.add.container(L.headPivot.x, L.headPivot.y);
    for (const [i, ex] of [-26, 24].entries()) {
      const ear = scene.add.image(ex, L.headOffsetY - 34, 'cat-ear').setOrigin(0.5, 1).setScale(EAR_SCALE);
      ear.setAngle(i === 0 ? -14 : 14);
      this.headPivot.add(ear);
      this.ears.push(ear);
    }
    this.head = scene.add.image(0, L.headOffsetY, 'cat-head').setOrigin(0.5, 0.5).setScale(SVG_SCALE);
    this.headHappy = scene.add.image(0, L.headOffsetY, 'cat-head-happy').setOrigin(0.5, 0.5).setScale(SVG_SCALE);
    this.headHappy.setVisible(false);
    this.headPivot.add([this.head, this.headHappy]);
    this.root.add(this.headPivot);

    if (tint !== undefined) {
      for (const part of [this.body, this.head, this.headHappy, ...this.ears,
        ...this.backLegs, ...this.frontLegs]) {
        part.setTint(tint);
      }
      for (const segment of this.tail) {
        (segment.list[0] as Phaser.GameObjects.Image).setTint(tint);
      }
    }

    this.setFacing(-1);
  }

  get x(): number { return this.root.x; }
  get y(): number { return this.root.y; }

  setFacing(dir: 1 | -1): void {
    this.facing = dir;
    this.root.setScale(this.baseScale * dir, this.baseScale);
  }

  /** Показать зажмуренную морду вместо обычной */
  private setHappyFace(happy: boolean): void {
    this.head.setVisible(!happy);
    this.headHappy.setVisible(happy);
  }

  // ---------------------------------------------------------------- такт

  update(delta: number): void {
    const dt = delta / 1000;
    this.phase += dt;

    switch (this.state) {
      case 'run': {
        const p = this.phase * 13;
        // лапы ходят противофазой, корпус подпрыгивает — пружинящая походка
        this.backLegs[0].setAngle(Math.sin(p) * 34);
        this.backLegs[1].setAngle(Math.sin(p + Math.PI) * 30);
        this.frontLegs[0].setAngle(Math.sin(p + Math.PI) * 32);
        this.frontLegs[1].setAngle(Math.sin(p) * 28);
        const bob = Math.abs(Math.sin(p)) * 7;
        this.body.setPosition(0, L.bodyY - bob);
        this.body.setAngle(Math.sin(p) * 3);
        this.headPivot.setPosition(L.headPivot.x, L.headPivot.y - bob * 1.1);
        this.headPivot.setAngle(-4 + Math.sin(p) * 3);
        this.waveTail(p * 0.5, 16);
        break;
      }
      case 'idle': {
        const p = this.phase * 1.8;
        const breath = 1 + Math.sin(p) * 0.02;
        this.body.setScale(SVG_SCALE, SVG_SCALE * breath);
        this.headPivot.setAngle(Math.sin(p * 0.7) * 2.5);
        this.waveTail(this.phase * 1.4, 12);
        break;
      }
      case 'rub': {
        const p = this.phase * 6;
        this.body.setAngle(-8 + Math.sin(p) * 4);
        this.headPivot.setAngle(-10 + Math.sin(p) * 6);
        // хвост дугой вверх — знак довольной кошки
        this.tail[0].setAngle(-58);
        this.tail[1].setAngle(-34);
        this.tail[2].setAngle(-26 + Math.sin(p * 0.6) * 6);
        break;
      }
      case 'eat': {
        const p = this.phase * 9;
        // ритмичное покачивание головой над миской
        this.headPivot.setAngle(24 + Math.sin(p) * 7);
        this.headPivot.setPosition(L.headPivot.x + 14, L.headPivot.y + 26 + Math.sin(p) * 5);
        this.body.setAngle(4);
        this.waveTail(this.phase * 4.5, 22);
        break;
      }
      case 'sit': {
        const p = this.phase * 1.6;
        this.body.setScale(SVG_SCALE, SVG_SCALE * (1 + Math.sin(p) * 0.02));
        this.headPivot.setAngle(-6 + Math.sin(p * 0.8) * 3);
        this.waveTail(this.phase * 1.1, 8);
        break;
      }
      case 'wash': {
        const p = this.phase * 7;
        // передняя лапа ходит к морде, голова наклоняется к ней
        this.frontLegs[1].setAngle(-70 + Math.sin(p) * 16);
        this.headPivot.setAngle(-14 + Math.sin(p) * 9);
        this.waveTail(this.phase * 1.2, 7);
        break;
      }
    }
  }

  /** Волна по хвосту: каждый следующий сегмент отстаёт по фазе */
  private waveTail(t: number, amplitude: number): void {
    for (let i = 0; i < this.tail.length; i++) {
      this.tail[i].setAngle(TAIL_REST[i] + Math.sin(t - i * 0.6) * amplitude);
    }
  }

  // ---------------------------------------------------------------- действия

  /** Заметила игрока: уши торчком, подскок, разворот */
  notice(onDone?: () => void): void {
    this.state = 'idle';
    this.scene.tweens.add({
      targets: this.ears,
      angle: 0,
      scaleY: EAR_SCALE * 1.15,
      duration: 180,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.root,
      y: this.root.y - 16,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => onDone?.(),
    });
  }

  /** Бежит к точке пружинящей походкой */
  runTo(x: number, speed = 260, onDone?: () => void): void {
    const distance = Math.abs(x - this.root.x);
    this.setFacing(x < this.root.x ? -1 : 1);
    this.state = 'run';
    this.scene.tweens.add({
      targets: this.root,
      x,
      duration: (distance / speed) * 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.state = 'idle';
        this.resetPose();
        onDone?.();
      },
    });
  }

  /** Трётся о ногу игрока */
  rub(durationMs: number, onDone?: () => void): void {
    this.state = 'rub';
    this.scene.tweens.add({
      targets: this.root,
      x: this.root.x + 10 * this.facing,
      duration: 620,
      yoyo: true,
      repeat: Math.max(0, Math.floor(durationMs / 1240) - 1),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.state = 'idle';
        this.resetPose();
        onDone?.();
      },
    });
  }

  /** Ест из миски */
  startEating(): void {
    this.state = 'eat';
    this.setHappyFace(false);
  }

  /** Садится: задние лапы поджимаются, корпус приподнимается */
  sit(onDone?: () => void): void {
    this.state = 'sit';
    this.scene.tweens.add({
      targets: this.backLegs,
      angle: 72,
      duration: 380,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.frontLegs,
      angle: 0,
      duration: 380,
    });
    this.scene.tweens.add({
      targets: this.body,
      angle: -14,
      y: L.bodyY + 12,
      duration: 420,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.headPivot,
      x: L.headPivot.x - 8,
      y: L.headPivot.y - 6,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => onDone?.(),
    });
  }

  /** Умывается лапой и жмурится */
  wash(): void {
    this.state = 'wash';
    this.setHappyFace(true);
  }

  /** Возврат частей в нейтральное положение */
  private resetPose(): void {
    for (const leg of [...this.backLegs, ...this.frontLegs]) leg.setAngle(0);
    this.body.setPosition(0, L.bodyY);
    this.body.setAngle(0);
    this.headPivot.setPosition(L.headPivot.x, L.headPivot.y);
    this.headPivot.setAngle(0);
  }

  destroy(): void {
    this.root.destroy();
  }
}
