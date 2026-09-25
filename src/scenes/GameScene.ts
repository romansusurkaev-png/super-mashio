/** Сам уровень: мир, игрок, корм, опасности и переход в финал с кормлением. */

import Phaser from 'phaser';
import { getPalette, type Palette } from '../config/palettes';
import { Cat } from '../entities/Cat';
import { Hazard } from '../entities/Hazard';
import { Pickup } from '../entities/Pickup';
import { EMPTY_INPUT, Player, type PlayerInputState } from '../entities/Player';
import { expandPickups, type LevelDef } from '../levels/types';
import { audio } from '../systems/AudioManager';
import { Finale } from '../systems/Finale';
import { Fx } from '../systems/Fx';
import { Parallax } from '../systems/Parallax';
import { Save } from '../systems/Save';
import { SVG_SCALE, VIEW_H, mix, onWidthChange } from '../systems/Textures';
import { HUD } from '../ui/HUD';
import { TouchControls } from '../ui/TouchControls';
import { LEVELS } from '../levels';

export class GameScene extends Phaser.Scene {
  private level!: LevelDef;
  private palette!: Palette;

  private player!: Player;
  private cat!: Cat;
  private bowl!: Phaser.GameObjects.Image;
  private hud!: HUD;
  private fx!: Fx;
  private parallax!: Parallax;
  private touch!: TouchControls;

  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private pickups: Pickup[] = [];
  private hazards: Hazard[] = [];

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private score = 0;
  private streak = 0;
  private streakTimer = 0;
  private invulnerable = 0;
  private lastSafeX = 0;
  private finished = false;
  private paused = false;

  constructor() {
    super('game');
  }

  init(data: { level?: number }): void {
    this.level = LEVELS[data.level ?? 1] ?? LEVELS[1];
    this.palette = getPalette(this.level.palette);
    this.score = 0;
    this.streak = 0;
    this.finished = false;
    this.paused = false;
    this.pickups = [];
    this.hazards = [];
  }

  create(): void {
    const level = this.level;

    this.physics.world.setBounds(0, -600, level.width, level.height + 900);
    this.cameras.main.setBounds(0, 0, level.width, level.height);

    this.parallax = new Parallax(this, this.palette, level.palette);
    this.fx = new Fx(this, this.palette);

    this.buildTerrain();
    this.buildDecor();
    this.buildFinish();

    // --- игрок
    this.player = new Player(this, level.spawn.x, level.spawn.y);
    this.player.sprite.setTint(this.palette.playerTint);
    this.physics.add.collider(this.player.hitbox, this.solids);
    this.lastSafeX = level.spawn.x;

    this.player.on('jump', () => audio.jump());
    this.player.on('double-jump', (x: number, y: number) => {
      audio.doubleJump();
      this.fx.dust(x, y, 0.3);
    });
    this.player.on('land', (x: number, y: number, impact: number) => {
      audio.land(impact);
      this.fx.dust(x, y, 0.35 + impact);
    });
    this.player.on('turn', (x: number, y: number) => this.fx.dust(x, y, 0.25, this.player.facing));
    this.player.on('dash', (x: number, y: number, dir: number) => {
      audio.dash();
      this.fx.dashTrail(x, y, dir);
    });

    this.buildPickups();
    this.buildHazards();
    this.warnAboutUnreachablePickups();

    // --- камера: мягкое следование с мёртвой зоной и заглядыванием вперёд
    const cam = this.cameras.main;
    cam.startFollow(this.player.hitbox, true, 0.1, 0.12);
    cam.setDeadzone(200, 160);
    cam.setFollowOffset(0, -40);
    let vignette: Phaser.GameObjects.Image | undefined;
    if (this.game.renderer.type === Phaser.WEBGL) {
      cam.postFX.addVignette(0.5, 0.5, 0.78, 0.4);
    } else {
      vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(90).setAlpha(0.8)
        .setDisplaySize(this.scale.width, VIEW_H);
    }
    cam.fadeIn(500, 0, 0, 0);

    this.fx.ambient();

    // --- управление
    this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,SHIFT,ESC') as
      Record<string, Phaser.Input.Keyboard.Key>;
    this.touch = new TouchControls(this, this.palette);

    this.hud = new HUD(this, level, this.palette, audio.isMuted);
    this.hud.onMute = () => {
      const muted = audio.toggleMute();
      if (!muted) audio.startMusic();
      return muted;
    };
    this.hud.onPause = () => this.togglePause();
    this.hud.setScore(0);

    // телефон повернули или браузер спрятал панели — прижимаем интерфейс к новым краям
    onWidthChange(this, (width) => {
      this.hud.layout(width);
      this.touch.layout(width);
      this.parallax.layout(width);
      vignette?.setDisplaySize(width, VIEW_H);
    });

    // звук можно включать только после первого действия пользователя
    const unlock = () => {
      audio.unlock();
      audio.startMusic();
    };
    this.input.once('pointerdown', unlock);
    this.input.keyboard!.once('keydown', unlock);

    this.events.on('shutdown', () => audio.stopMusic());
  }

  // ---------------------------------------------------------------- построение мира

  /** Земля и платформы: скруглённые блоки с травяной кромкой */
  private buildTerrain(): void {
    this.solids = this.physics.add.staticGroup();
    const g = this.add.graphics().setDepth(1);
    const p = this.palette;

    for (const plat of this.level.platforms) {
      const body = this.add.rectangle(plat.x + plat.w / 2, plat.y + plat.h / 2, plat.w, plat.h);
      body.setVisible(false);
      this.solids.add(body);

      g.fillStyle(mix(p.ground, 0x120c1e, 0.35), 1);
      g.fillRoundedRect(plat.x, plat.y + 4, plat.w, plat.h, 14);
      g.fillStyle(p.ground, 1);
      g.fillRoundedRect(plat.x, plat.y, plat.w, plat.h, 14);

      if (plat.grass !== false) {
        g.fillStyle(p.groundTop, 1);
        g.fillRoundedRect(plat.x, plat.y, plat.w, 22, 11);
        // во дворе сверху трава волной, в помещении — ровная кромка столешницы
        if (p.theme === 'yard') {
          for (let x = plat.x + 8; x < plat.x + plat.w - 8; x += 18) {
            g.fillCircle(x, plat.y + 4, 9);
          }
        }
        g.fillStyle(p.groundEdge, 1);
        g.fillRect(plat.x, plat.y + 22, plat.w, 3);
      }
    }
  }

  private buildDecor(): void {
    const prefix = this.level.palette;
    for (const item of this.level.decor) {
      const image = this.add.image(item.x, item.y + 6, `${prefix}-${item.kind}`)
        .setOrigin(0.5, 1)
        .setScale(item.scale ?? 1)
        .setDepth(item.back ? 0 : 2);
      // лёгкое покачивание — помечается флагом в JSON уровня
      if (item.sway) {
        this.tweens.add({
          targets: image,
          angle: { from: -1.2, to: 1.2 },
          duration: 2600 + Math.random() * 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  /**
   * Финал стартует раньше самой миски, и корм, лежащий за этой чертой, собрать уже нельзя.
   * Проверка ловит это при правке уровня, чтобы не искать потом руками.
   */
  private warnAboutUnreachablePickups(): void {
    if (!import.meta.env.DEV) return;
    const limit = this.finaleTriggerX();
    const lost = expandPickups(this.level.pickups).filter((item) => item.x > limit);
    if (lost.length) {
      console.warn(
        `[${this.level.name}] ${lost.length} предмет(ов) лежит за точкой старта финала (x > ${Math.round(limit)}) — их не собрать:`,
        lost.map((item) => `${item.type}@${Math.round(item.x)}`).join(', '),
      );
    }
  }

  /** Где включается финал: заранее, чтобы игрок дошёл до миски своими ногами */
  private finaleTriggerX(): number {
    return this.level.finish.x - 320;
  }

  private buildPickups(): void {
    const group = this.physics.add.group();
    for (const def of expandPickups(this.level.pickups)) {
      const pickup = new Pickup(this, def.x, def.y, def.type);
      this.pickups.push(pickup);
      group.add(pickup.sprite);
    }
    this.physics.add.overlap(this.player.hitbox, group, (_a, b) => {
      const pickup = (b as Phaser.GameObjects.GameObject).getData('pickup') as Pickup;
      this.collect(pickup);
    });
  }

  private buildHazards(): void {
    const group = this.physics.add.group();
    for (const def of this.level.hazards) {
      const hazard = new Hazard(this, def);
      this.hazards.push(hazard);
      group.add(hazard.sprite);
      if (def.type === 'icicle') {
        (hazard.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      }
    }
    this.physics.add.overlap(this.player.hitbox, group, (_a, b) => {
      const hazard = (b as Phaser.GameObjects.GameObject).getData('hazard') as Hazard;
      this.hurt(hazard);
    });
  }

  /** Миска и кошка в конце уровня */
  private buildFinish(): void {
    const { x, y } = this.level.finish;
    this.bowl = this.add.image(x, y + 4, 'bowl')
      .setOrigin(0.5, 1)
      .setScale(SVG_SCALE * 0.62)
      .setDepth(5);

    this.cat = new Cat(this, x + 210, y + 4, 0.32, mix(0xffffff, this.palette.accent, 0.25));
  }

  // ---------------------------------------------------------------- события

  private collect(pickup: Pickup): void {
    if (!pickup || pickup.isTaken) return;

    const target = this.hud.targetWorldPoint();
    pickup.collect(target.x, target.y, () => {
      this.score += pickup.value;
      this.hud.setScore(this.score);
      this.hud.pulse();
      this.fx.collectBurst(target.x, target.y, pickup.tint);
    });

    if (pickup.type === 'can' || pickup.type === 'fish') audio.treasure();
    else audio.collect(this.streak);

    this.streak = Math.min(this.streak + 1, 4);
    this.streakTimer = 900;
  }

  private hurt(hazard: Hazard): void {
    if (this.invulnerable > 0 || this.finished || !hazard) return;
    this.invulnerable = 1100;

    const lost = Math.min(this.score, hazard.cost.food);
    this.score -= lost;
    this.streak = 0;
    this.hud.setScore(this.score);

    const away = this.player.x < hazard.sprite.x ? -1 : 1;
    this.player.body.setVelocity(hazard.cost.knock * away, -320);

    audio.hit();
    this.fx.shake(0.01, 220);
    if (lost > 0) this.fx.hitBurst(this.player.x, this.player.y, lost);

    // мигание неуязвимости
    this.tweens.add({
      targets: this.player.sprite,
      alpha: 0.35,
      duration: 110,
      yoyo: true,
      repeat: 4,
      onComplete: () => this.player.sprite.setAlpha(1),
    });
  }

  /** Упал в яму: возвращаем на последнее безопасное место, немного корма теряется */
  private respawn(): void {
    this.player.setPosition(this.lastSafeX, this.level.finish.y - 40);
    this.player.body.setVelocity(0, 0);
    const lost = Math.min(this.score, 4);
    this.score -= lost;
    this.hud.setScore(this.score);
    if (lost > 0) this.fx.hitBurst(this.player.x, this.player.y, lost);
    audio.hit();
    this.cameras.main.flash(220, 20, 16, 40);
  }

  private togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.pause();
      this.scene.launch('pause');
      this.scene.bringToTop('pause');
    } else {
      this.physics.resume();
      this.scene.stop('pause');
    }
  }

  resume(): void {
    this.paused = false;
    this.physics.resume();
  }

  // ---------------------------------------------------------------- финал

  private async startFinale(): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    audio.stopMusic();

    const finale = new Finale({
      scene: this,
      player: this.player,
      cat: this.cat,
      bowl: this.bowl,
      fx: this.fx,
      palette: this.palette,
      getScore: () => this.score,
      setScore: (value) => {
        this.score = value;
        this.hud.setScore(value);
      },
    });

    const earned = this.score;
    await finale.play();

    const stars = this.level.stars.filter((threshold) => earned >= threshold).length;
    Save.finishLevel(this.level.id, earned, stars);

    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(650, () => {
      this.scene.start('result', {
        level: this.level.id,
        name: this.level.name,
        catName: this.level.catName,
        score: earned,
        stars,
        palette: this.level.palette,
        feminine: this.level.catFeminine ?? false,
      });
    });
  }

  // ---------------------------------------------------------------- такт

  update(_time: number, delta: number): void {
    if (this.paused) return;

    const input = this.readInput();
    this.player.update(delta, input, this.groundUnderPlayer());
    this.cat.update(delta);

    for (const hazard of this.hazards) hazard.update(delta, this.player.x);

    this.parallax.update(this.cameras.main.scrollX);
    this.touch.update();

    this.invulnerable = Math.max(0, this.invulnerable - delta);
    this.streakTimer -= delta;
    if (this.streakTimer <= 0) this.streak = 0;

    // заглядывание вперёд по направлению бега
    const lookAhead = this.player.facing * 90;
    const cam = this.cameras.main;
    cam.followOffset.x = Phaser.Math.Linear(cam.followOffset.x, -lookAhead, 0.04);

    if (this.player.body.blocked.down) this.lastSafeX = this.player.x;
    if (this.player.y > this.level.height + 160) this.respawn();

    if (!this.finished && this.player.x > this.finaleTriggerX()) {
      void this.startFinale();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.togglePause();
  }

  private readInput(): PlayerInputState {
    if (this.finished) return EMPTY_INPUT;

    const k = this.keys;
    const touch = this.touch.enabled ? this.touch.consume() : null;
    const jumpKey = k.SPACE.isDown || k.UP.isDown || k.W.isDown;

    return {
      left: k.LEFT.isDown || k.A.isDown || (touch?.left ?? false),
      right: k.RIGHT.isDown || k.D.isDown || (touch?.right ?? false),
      jumpHeld: jumpKey || (touch?.jumpHeld ?? false),
      jumpJustPressed: Phaser.Input.Keyboard.JustDown(k.SPACE)
        || Phaser.Input.Keyboard.JustDown(k.UP)
        || Phaser.Input.Keyboard.JustDown(k.W)
        || (touch?.jumpJustPressed ?? false),
      dashJustPressed: Phaser.Input.Keyboard.JustDown(k.SHIFT)
        || (touch?.dashJustPressed ?? false),
    };
  }

  /** Уровень пола под игроком — по нему ставится контактная тень */
  private groundUnderPlayer(): number {
    let best = this.level.height + 200;
    for (const plat of this.level.platforms) {
      if (this.player.x < plat.x - 10 || this.player.x > plat.x + plat.w + 10) continue;
      if (plat.y + 1 < this.player.y) continue;
      best = Math.min(best, plat.y);
    }
    return best;
  }
}
