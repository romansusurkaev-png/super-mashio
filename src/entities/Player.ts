/**
 * Игрок: физика отдельно, картинка отдельно.
 *
 * Хитбокс — невидимый прямоугольник с Arcade-телом, а фото-спрайт просто
 * следует за ним. Так squash & stretch, наклоны и подвижка кадров не трогают
 * физику: растягивай спрайт сколько хочешь, хитбокс останется прежним.
 */

import Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { ContactShadow } from './ContactShadow';
import {
  FRAME_NUDGE,
  PLAYER_TEXTURE,
  registerPlayerAnimations,
  walkFrameRate,
} from './PlayerAnimations';

export interface PlayerInputState {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  dashJustPressed: boolean;
}

export const EMPTY_INPUT: PlayerInputState = {
  left: false,
  right: false,
  jumpHeld: false,
  jumpJustPressed: false,
  dashJustPressed: false,
};

type MotionState = 'idle' | 'walk' | 'jump' | 'fall' | 'dash';

export class Player extends Phaser.Events.EventEmitter {
  readonly scene: Phaser.Scene;
  /** Невидимый прямоугольник — это и есть настоящий персонаж для физики */
  readonly hitbox: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: ContactShadow;

  /** Куда смотрит: 1 — вправо, -1 — влево */
  facing: 1 | -1 = 1;
  state: MotionState = 'idle';
  /** Дополнительный наклон корпуса — им пользуется финальная сцена (присел погладить) */
  extraTilt = 0;

  private squashX = 1;
  private squashY = 1;
  private breath = 1;
  private breathWeight = 0;
  private tilt = 0;

  private jumpsLeft = TUNING.jump.maxJumps;
  private coyoteTimer = 0;
  private bufferTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private ghostTimer = 0;
  private landHold = 0;
  private wasOnGround = true;
  private lastGroundY: number;
  private prevVelocityY = 0;
  private squashTween?: Phaser.Tweens.Tween;
  private walkTarget: number | null = null;
  private walkDone?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super();
    this.scene = scene;
    this.lastGroundY = y;

    registerPlayerAnimations(scene);

    this.shadow = new ContactShadow(scene, 4);

    this.sprite = scene.add.sprite(x, y, PLAYER_TEXTURE, 'idle');
    this.sprite.setOrigin(0.5, Player.originY(scene));
    this.sprite.setScale(TUNING.sprite.scale);
    this.sprite.setDepth(5);
    this.sprite.play('player-idle');

    this.hitbox = scene.add.rectangle(x, y - TUNING.hitbox.height / 2,
      TUNING.hitbox.width, TUNING.hitbox.height, 0x00ff88, 0);
    scene.physics.add.existing(this.hitbox);
    this.body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    this.body.setGravityY(TUNING.jump.gravity);
    this.body.setMaxVelocityY(TUNING.jump.maxFallSpeed);
    this.body.setCollideWorldBounds(true);

    // «дыхание» крутится всегда, но подмешивается только в стойке
    scene.tweens.add({
      targets: this,
      breath: 1 + TUNING.anim.breathScale,
      duration: TUNING.anim.breathMs / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Origin по вертикали берём из меты атласа: там записано, где у кадра ноги */
  private static originY(scene: Phaser.Scene): number {
    const meta = scene.cache.json.get('player-meta') as { origin?: { y: number } } | undefined;
    return meta?.origin?.y ?? 0.87;
  }

  get x(): number { return this.hitbox.x; }
  get y(): number { return this.body.bottom; }

  /** Перечитывает размер хитбокса из TUNING — нужно, если крутим масштаб на лету */
  applyHitboxSize(): void {
    const feet = this.y;
    this.hitbox.setSize(TUNING.hitbox.width, TUNING.hitbox.height);
    this.body.setSize(TUNING.hitbox.width, TUNING.hitbox.height);
    this.setPosition(this.x, feet);
  }

  setPosition(x: number, feetY: number): void {
    this.hitbox.setPosition(x, feetY - TUNING.hitbox.height / 2);
    this.body.reset(x, feetY - TUNING.hitbox.height / 2);
    this.lastGroundY = feetY;
  }

  // ------------------------------------------------------------------ такт

  /**
   * Скриптовая ходьба к точке: игрок идёт сам, с обычной анимацией и физикой.
   * Нужна финальной сцене — тащить спрайт твином было бы видно по мёртвым ногам.
   */
  walkTo(x: number, onDone?: () => void): void {
    this.walkTarget = x;
    this.walkDone = onDone;
  }

  update(delta: number, rawInput: PlayerInputState, groundY?: number): void {
    let input = rawInput;
    if (this.walkTarget !== null) {
      const dx = this.walkTarget - this.x;
      if (Math.abs(dx) < 12) {
        this.walkTarget = null;
        const done = this.walkDone;
        this.walkDone = undefined;
        input = EMPTY_INPUT;
        done?.();
      } else {
        input = { ...EMPTY_INPUT, left: dx < 0, right: dx > 0 };
      }
    }

    const dt = delta / 1000;
    const onGround = this.body.blocked.down || this.body.touching.down;

    this.updateTimers(delta, onGround);
    this.handleLanding(onGround);
    if (this.dashTimer > 0) this.updateDash(delta);
    else this.updateWalk(dt, input, onGround);

    this.handleJump(input, onGround);
    this.handleDash(input);
    this.updateGravity(input, onGround);
    this.updateState(onGround);
    this.syncSprite(delta, onGround, groundY);

    this.wasOnGround = onGround;
    this.prevVelocityY = this.body.velocity.y;
  }

  private updateTimers(delta: number, onGround: boolean): void {
    this.coyoteTimer = onGround ? TUNING.jump.coyoteMs : Math.max(0, this.coyoteTimer - delta);
    this.bufferTimer = Math.max(0, this.bufferTimer - delta);
    this.dashTimer = Math.max(0, this.dashTimer - delta);
    this.dashCooldown = Math.max(0, this.dashCooldown - delta);
    this.landHold = Math.max(0, this.landHold - delta);
    if (onGround) {
      this.jumpsLeft = TUNING.jump.maxJumps;
      this.lastGroundY = this.body.bottom;
    }
  }

  private updateWalk(dt: number, input: PlayerInputState, onGround: boolean): void {
    const m = TUNING.move;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const vx = this.body.velocity.x;

    if (dir !== 0) {
      const turning = Math.sign(vx) !== 0 && Math.sign(vx) !== dir;
      let accel = m.accel * (turning ? m.turnBoost : 1);
      if (!onGround) accel *= m.airControl;
      const next = Phaser.Math.Clamp(vx + dir * accel * dt, -m.walkSpeed, m.walkSpeed);
      this.body.setVelocityX(next);

      if (turning && onGround && Math.abs(vx) > m.walkSpeed * 0.5) {
        this.emit('turn', this.x, this.y);
      }
      if (dir !== this.facing) this.facing = dir as 1 | -1;
    } else {
      const decel = (onGround ? m.decelGround : m.decelAir) * dt;
      this.body.setVelocityX(Math.abs(vx) <= decel ? 0 : vx - Math.sign(vx) * decel);
    }
  }

  private handleJump(input: PlayerInputState, onGround: boolean): void {
    if (input.jumpJustPressed) this.bufferTimer = TUNING.jump.bufferMs;

    const canGroundJump = this.coyoteTimer > 0 && this.jumpsLeft === TUNING.jump.maxJumps;
    const canAirJump = this.jumpsLeft > 0 && !canGroundJump;
    if (this.bufferTimer <= 0 || this.dashTimer > 0) return;
    if (!canGroundJump && !canAirJump) return;

    const first = canGroundJump;
    this.body.setVelocityY(first ? TUNING.jump.velocity : TUNING.jump.doubleVelocity);
    this.jumpsLeft = first ? TUNING.jump.maxJumps - 1 : this.jumpsLeft - 1;
    this.bufferTimer = 0;
    this.coyoteTimer = 0;

    this.playSquash(TUNING.squash.crouchScaleX, TUNING.squash.crouchScaleY,
      TUNING.squash.crouchMs, TUNING.squash.stretchScaleX, TUNING.squash.stretchScaleY);
    this.emit(first ? 'jump' : 'double-jump', this.x, this.y);
    void onGround;
  }

  private handleDash(input: PlayerInputState): void {
    if (!input.dashJustPressed || this.dashCooldown > 0 || this.dashTimer > 0) return;
    this.dashTimer = TUNING.dash.durationMs;
    this.dashCooldown = TUNING.dash.cooldownMs + TUNING.dash.durationMs;
    this.ghostTimer = 0;
    this.body.setVelocityY(0);
    this.emit('dash', this.x, this.y, this.facing);
  }

  private updateDash(delta: number): void {
    this.body.setVelocityX(TUNING.dash.speed * this.facing);
    this.body.setVelocityY(0);

    this.ghostTimer -= delta;
    if (this.ghostTimer <= 0) {
      this.ghostTimer = TUNING.dash.ghostIntervalMs;
      this.spawnGhost();
    }
  }

  private updateGravity(input: PlayerInputState, onGround: boolean): void {
    if (this.dashTimer > 0) {
      this.body.setAllowGravity(false);
      return;
    }
    this.body.setAllowGravity(true);

    // отпустил кнопку на взлёте — прыжок укорачивается
    if (!input.jumpHeld && this.body.velocity.y < 0) {
      this.body.setVelocityY(this.body.velocity.y * TUNING.jump.cutMultiplier);
    }

    const falling = this.body.velocity.y > 0 && !onGround;
    this.body.setGravityY(TUNING.jump.gravity * (falling ? TUNING.jump.fallGravityMul : 1));
  }

  private handleLanding(onGround: boolean): void {
    if (!onGround || this.wasOnGround) return;
    const impact = Phaser.Math.Clamp(this.prevVelocityY / TUNING.jump.maxFallSpeed, 0, 1);
    const s = TUNING.squash;
    // держим кадр прыжка ещё несколько кадров после касания — это и есть «приземление»
    this.landHold = s.landMs;
    this.playSquash(
      Phaser.Math.Linear(1, s.landScaleX, 0.4 + impact * 0.6),
      Phaser.Math.Linear(1, s.landScaleY, 0.4 + impact * 0.6),
      s.landMs, 1, 1, s.recoverMs,
    );
    this.emit('land', this.x, this.y, impact);
  }

  // ------------------------------------------------------------------ вид

  private updateState(onGround: boolean): void {
    let next: MotionState;
    if (this.dashTimer > 0) next = 'dash';
    else if (this.landHold > 0) next = 'fall';
    else if (!onGround) next = this.body.velocity.y < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.body.velocity.x) > 8) next = 'walk';
    else next = 'idle';

    if (next !== this.state) {
      this.state = next;
      this.sprite.play(`player-${next}`, true);
    }
    if (next === 'walk') {
      const a = TUNING.anim;
      this.sprite.anims.msPerFrame =
        1000 / walkFrameRate(this.body.velocity.x, a.walkFpsMin, a.walkFpsMax, a.walkFpsSpeedRef);
    }
  }

  private syncSprite(delta: number, onGround: boolean, groundY?: number): void {
    const t = TUNING.sprite;

    // наклон по вертикальной скорости: вверх — вперёд, вниз — назад
    const target = onGround
      ? 0
      : Phaser.Math.Clamp(-this.body.velocity.y * t.tiltPerSpeed, -t.tiltMax, t.tiltMax) * this.facing;
    this.tilt = Phaser.Math.Linear(this.tilt, target, t.tiltLerp);
    this.sprite.setAngle(this.tilt + this.extraTilt);

    // дыхание подмешиваем только в стойке
    const wantBreath = this.state === 'idle' ? 1 : 0;
    this.breathWeight = Phaser.Math.Linear(this.breathWeight, wantBreath, 0.12);
    const breath = 1 + (this.breath - 1) * this.breathWeight;
    const bob = Math.sin(this.scene.time.now / (TUNING.anim.breathMs / (Math.PI * 2)))
      * TUNING.anim.breathBobY * this.breathWeight;

    this.sprite.setFlipX(this.facing === -1);
    this.sprite.setScale(t.scale * this.squashX, t.scale * this.squashY * breath);

    const nudge = FRAME_NUDGE[this.sprite.frame.name] ?? { x: 0, y: 0 };
    this.sprite.setPosition(
      this.x + nudge.x * t.scale * this.facing,
      this.y + bob + nudge.y * t.scale,
    );

    const floor = groundY ?? this.lastGroundY;
    this.shadow.update(this.x, floor, Math.max(0, floor - this.y));
    void delta;
  }

  /** Быстрое сжатие/растяжение и возврат. Всё в пределах 10-12%, иначе фото кривится. */
  private playSquash(x1: number, y1: number, ms: number, x2 = 1, y2 = 1, backMs = ms): void {
    this.squashTween?.stop();
    this.squashX = x1;
    this.squashY = y1;
    this.squashTween = this.scene.tweens.add({
      targets: this,
      squashX: x2,
      squashY: y2,
      duration: ms,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.squashTween = this.scene.tweens.add({
          targets: this,
          squashX: 1,
          squashY: 1,
          duration: backMs,
          ease: 'Back.easeOut',
        });
      },
    });
  }

  /** Полупрозрачная копия спрайта — шлейф за рывком */
  private spawnGhost(): void {
    const ghost = this.scene.add.sprite(this.sprite.x, this.sprite.y,
      PLAYER_TEXTURE, this.sprite.frame.name);
    ghost.setOrigin(this.sprite.originX, this.sprite.originY);
    ghost.setScale(this.sprite.scaleX * 1.06, this.sprite.scaleY * 0.96); // лёгкий motion blur
    ghost.setFlipX(this.sprite.flipX);
    ghost.setAngle(this.sprite.angle);
    ghost.setAlpha(TUNING.dash.ghostAlpha);
    ghost.setTint(0x9ad9ff);
    ghost.setDepth(this.sprite.depth - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: ghost.scaleX * 0.94,
      duration: TUNING.dash.ghostLifeMs,
      onComplete: () => ghost.destroy(),
    });
  }

  destroy(): void {
    this.sprite.destroy();
    this.hitbox.destroy();
    this.shadow.destroy();
    this.removeAllListeners();
  }
}
