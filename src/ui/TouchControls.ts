/**
 * Тач-контролы: слева виртуальный джойстик, справа кнопки прыжка и рывка.
 * Появляются только на устройствах с тачем (или по ?touch=1 для проверки на компьютере).
 */

import Phaser from 'phaser';
import type { Palette } from '../config/palettes';
import { VIEW_H, VIEW_W } from '../systems/Textures';

export interface TouchState {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  dashJustPressed: boolean;
}

export class TouchControls {
  readonly enabled: boolean;
  private readonly scene: Phaser.Scene;

  private stickBase?: Phaser.GameObjects.Arc;
  private stickKnob?: Phaser.GameObjects.Arc;
  private stickPointer: Phaser.Input.Pointer | null = null;
  private stickOrigin = new Phaser.Math.Vector2();

  private axis = 0;
  private jumpHeld = false;
  private jumpQueued = false;
  private dashQueued = false;

  constructor(scene: Phaser.Scene, palette: Palette) {
    this.scene = scene;
    const forced = new URLSearchParams(location.search).has('touch');
    this.enabled = forced || scene.sys.game.device.input.touch;
    if (!this.enabled) return;

    const baseY = VIEW_H - 130;

    // --- джойстик: база фиксирована, но точку касания подхватываем в любом месте слева
    this.stickBase = scene.add.circle(180, baseY, 76, 0xffffff, 0.1)
      .setScrollFactor(0).setDepth(120).setStrokeStyle(3, palette.accent, 0.5);
    this.stickKnob = scene.add.circle(180, baseY, 34, palette.accent, 0.55)
      .setScrollFactor(0).setDepth(121);
    this.stickOrigin.set(180, baseY);

    const zone = scene.add.zone(0, VIEW_H / 2, VIEW_W / 2, VIEW_H / 2)
      .setOrigin(0, 0).setScrollFactor(0).setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.stickPointer = p;
      this.stickOrigin.set(p.x, p.y);
      this.stickBase!.setPosition(p.x, p.y);
      this.stickKnob!.setPosition(p.x, p.y);
    });

    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.stickPointer?.id === p.id) {
        this.stickPointer = null;
        this.axis = 0;
        this.stickBase!.setPosition(180, baseY);
        this.stickKnob!.setPosition(180, baseY);
        this.stickOrigin.set(180, baseY);
      }
    });

    this.actionButton(VIEW_W - 150, baseY, 62, '▲', palette.accent, () => {
      this.jumpQueued = true;
      this.jumpHeld = true;
    }, () => { this.jumpHeld = false; });

    this.actionButton(VIEW_W - 290, baseY + 40, 46, '»', 0x9ad9ff, () => {
      this.dashQueued = true;
    });
  }

  private actionButton(x: number, y: number, r: number, label: string, color: number,
                       onDown: () => void, onUp?: () => void): void {
    const circle = this.scene.add.circle(x, y, r, color, 0.28)
      .setScrollFactor(0).setDepth(120).setStrokeStyle(3, color, 0.6)
      .setInteractive({ useHandCursor: true });
    this.scene.add.text(x, y, label, {
      fontFamily: '"Baloo 2", Nunito, sans-serif', fontSize: `${r}px`, color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(121).setAlpha(0.85);

    circle.on('pointerdown', () => { circle.setFillStyle(color, 0.5); onDown(); });
    circle.on('pointerup', () => { circle.setFillStyle(color, 0.28); onUp?.(); });
    circle.on('pointerout', () => { circle.setFillStyle(color, 0.28); onUp?.(); });
  }

  update(): void {
    if (!this.enabled || !this.stickPointer) return;
    const dx = this.stickPointer.x - this.stickOrigin.x;
    const dy = this.stickPointer.y - this.stickOrigin.y;
    const clamped = new Phaser.Math.Vector2(dx, dy).limit(70);
    this.stickKnob!.setPosition(this.stickOrigin.x + clamped.x, this.stickOrigin.y + clamped.y);
    this.axis = Math.abs(dx) > 16 ? Math.sign(dx) : 0;
  }

  /** Читает состояние и сбрасывает «только что нажато» */
  consume(): TouchState {
    const state: TouchState = {
      left: this.axis < 0,
      right: this.axis > 0,
      jumpHeld: this.jumpHeld,
      jumpJustPressed: this.jumpQueued,
      dashJustPressed: this.dashQueued,
    };
    this.jumpQueued = false;
    this.dashQueued = false;
    return state;
  }
}
