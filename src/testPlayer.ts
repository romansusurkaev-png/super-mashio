/**
 * Тестовая страница персонажа: пустой фон, пол и всё, что умеет игрок.
 * Задача одна — отладить выравнивание кадров до того, как строить уровни.
 *
 * Панель справа двигает кадры вживую; кнопка внизу выдаёт готовый кусок
 * для scripts/photo-config.json.
 */

import Phaser from 'phaser';
import { TUNING } from './config/tuning';
import { EMPTY_INPUT, Player, PlayerInputState } from './entities/Player';
import { FRAME_NUDGE, PLAYER_TEXTURE } from './entities/PlayerAnimations';

const WIDTH = 900;
const HEIGHT = 560;
const GROUND_Y = 470;
const FRAME_NAMES = ['idle', 'step1', 'step2', 'jump'];

/** Исходные значения из tuning.ts — от них считаем пропорции при смене масштаба */
const BASE = {
  scale: TUNING.sprite.scale,
  hitboxW: TUNING.hitbox.width,
  hitboxH: TUNING.hitbox.height,
  shadowX: TUNING.shadow.radiusX,
  shadowY: TUNING.shadow.radiusY,
};

class TestScene extends Phaser.Scene {
  private player!: Player;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private guides!: Phaser.GameObjects.Graphics;
  private onion: Phaser.GameObjects.Sprite[] = [];
  private info!: Phaser.GameObjects.Text;
  private autoWalk = false;
  private autoDir: 1 | -1 = 1;

  /** что показываем — дёргается чекбоксами в панели */
  readonly show = { hitbox: true, shadow: true, grid: true, onion: false };

  constructor() {
    super('test');
  }

  preload(): void {
    this.load.atlas(PLAYER_TEXTURE, '/assets/player/player.png', '/assets/player/player.json');
    this.load.json('player-meta', '/assets/player/player.meta.json');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#20202e');

    // пол
    const ground = this.add.rectangle(WIDTH / 2, GROUND_Y + 30, WIDTH * 2, 60, 0x2c2c3f);
    this.physics.add.existing(ground, true);

    this.guides = this.add.graphics().setDepth(20);

    this.player = new Player(this, WIDTH / 2, GROUND_Y);
    this.physics.add.collider(this.player.hitbox, ground);
    this.physics.world.setBounds(0, -400, WIDTH, HEIGHT + 400);

    this.keys = this.input.keyboard!.addKeys(
      'LEFT,RIGHT,UP,A,D,W,SPACE,SHIFT,R',
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    this.info = this.add.text(16, 14, '', {
      fontFamily: 'ui-monospace, Consolas, monospace',
      fontSize: '13px',
      color: '#a9b4d0',
    }).setDepth(30);

    // «луковица»: все кадры друг на друге — сразу видно, что разъезжается
    for (const name of FRAME_NAMES) {
      const ghost = this.add.sprite(WIDTH - 150, GROUND_Y, PLAYER_TEXTURE, name);
      ghost.setOrigin(this.player.sprite.originX, this.player.sprite.originY);
      ghost.setScale(TUNING.sprite.scale);
      ghost.setAlpha(0.35);
      ghost.setDepth(19);
      ghost.setVisible(false);
      this.onion.push(ghost);
    }

    this.player.on('land', (_x: number, _y: number, impact: number) => this.puff(impact));
    this.player.on('turn', () => this.puff(0.3));

    setupPanel(this);
  }

  update(_time: number, delta: number): void {
    const input = this.readInput();
    this.player.update(delta, input, GROUND_Y);

    this.drawGuides();
    this.updateOnion();
    this.player.shadow.setVisible(this.show.shadow);

    const v = this.player.body.velocity;
    this.info.setText([
      `состояние: ${this.player.state}`,
      `скорость:  ${v.x.toFixed(0)} / ${v.y.toFixed(0)}`,
      `кадр:      ${this.player.sprite.frame.name}`,
      `fps:       ${this.game.loop.actualFps.toFixed(0)}`,
    ]);
  }

  private readInput(): PlayerInputState {
    const k = this.keys;
    if (this.autoWalk) {
      if (this.player.x > WIDTH - 140) this.autoDir = -1;
      if (this.player.x < 140) this.autoDir = 1;
      return { ...EMPTY_INPUT, left: this.autoDir === -1, right: this.autoDir === 1 };
    }
    const jump = k.SPACE.isDown || k.UP.isDown || k.W.isDown;
    return {
      left: k.LEFT.isDown || k.A.isDown,
      right: k.RIGHT.isDown || k.D.isDown,
      jumpHeld: jump,
      jumpJustPressed: Phaser.Input.Keyboard.JustDown(k.SPACE)
        || Phaser.Input.Keyboard.JustDown(k.UP)
        || Phaser.Input.Keyboard.JustDown(k.W),
      dashJustPressed: Phaser.Input.Keyboard.JustDown(k.SHIFT),
    };
  }

  /** Направляющие: пол, вертикаль под персонажем, хитбокс, сетка */
  private drawGuides(): void {
    const g = this.guides;
    g.clear();

    if (this.show.grid) {
      g.lineStyle(1, 0xffffff, 0.05);
      for (let x = 0; x < WIDTH; x += 50) g.lineBetween(x, 0, x, HEIGHT);
      for (let y = 0; y < HEIGHT; y += 50) g.lineBetween(0, y, WIDTH, y);
    }

    g.lineStyle(1, 0x6fd3ff, 0.7);
    g.lineBetween(0, GROUND_Y, WIDTH, GROUND_Y);

    if (this.show.hitbox) {
      const b = this.player.body;
      g.lineStyle(1, 0x59f2a0, 0.9);
      g.strokeRect(b.x, b.y, b.width, b.height);
      g.lineStyle(1, 0xff5f7e, 0.9);
      g.lineBetween(this.player.x, this.player.y - 150, this.player.x, this.player.y + 20);
    }
  }

  private updateOnion(): void {
    for (const ghost of this.onion) {
      ghost.setVisible(this.show.onion);
      if (!this.show.onion) continue;
      const nudge = FRAME_NUDGE[ghost.frame.name] ?? { x: 0, y: 0 };
      ghost.setScale(TUNING.sprite.scale);
      ghost.setPosition(
        WIDTH - 150 + nudge.x * TUNING.sprite.scale,
        GROUND_Y + nudge.y * TUNING.sprite.scale,
      );
    }
  }

  /** Пыль под ногами. В игре это будет нормальный эмиттер, здесь хватит кружков. */
  private puff(strength: number): void {
    const count = 4 + Math.round(strength * 6);
    for (let i = 0; i < count; i++) {
      const dot = this.add.circle(
        this.player.x + Phaser.Math.Between(-14, 14),
        this.player.y - Phaser.Math.Between(0, 6),
        Phaser.Math.Between(3, 7),
        0xd7cfe6, 0.5,
      ).setDepth(3);
      this.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-40, 40),
        y: dot.y - Phaser.Math.Between(6, 26),
        alpha: 0,
        scale: 0.2,
        duration: 320 + Math.random() * 220,
        ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  setAutoWalk(value: boolean): void {
    this.autoWalk = value;
  }

  /** После смены масштаба хитбокс и тень должны поехать за спрайтом */
  resizeHitbox(): void {
    this.player.applyHitboxSize();
  }

  resetPlayer(): void {
    this.player.setPosition(WIDTH / 2, GROUND_Y);
  }
}

// ---------------------------------------------------------------- панель управления

function setupPanel(scene: TestScene): void {
  const $ = (id: string) => document.getElementById(id)!;

  // ползунки подвижки кадров
  const nudgeRows = $('nudges');
  for (const name of FRAME_NAMES) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="row-title">${name}</div>
      <label>X <input type="range" min="-40" max="40" step="1" value="0" data-frame="${name}" data-axis="x"><span>0</span></label>
      <label>Y <input type="range" min="-40" max="40" step="1" value="0" data-frame="${name}" data-axis="y"><span>0</span></label>`;
    nudgeRows.appendChild(row);
  }
  nudgeRows.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const frame = slider.dataset.frame!;
      const axis = slider.dataset.axis as 'x' | 'y';
      FRAME_NUDGE[frame][axis] = Number(slider.value);
      slider.nextElementSibling!.textContent = slider.value;
    });
  });

  // чекбоксы показа
  const toggles: Array<[string, keyof TestScene['show']]> = [
    ['t-hitbox', 'hitbox'], ['t-shadow', 'shadow'], ['t-grid', 'grid'], ['t-onion', 'onion'],
  ];
  for (const [id, key] of toggles) {
    const box = $(id) as HTMLInputElement;
    box.checked = scene.show[key];
    box.addEventListener('change', () => { scene.show[key] = box.checked; });
  }

  // фон
  ($('bg') as HTMLSelectElement).addEventListener('change', (e) => {
    scene.cameras.main.setBackgroundColor((e.target as HTMLSelectElement).value);
  });

  // масштаб спрайта: хитбокс и тень тянутся за ним, иначе картинка «поедет» от физики
  bindNumber('scale', 'scale-val', (v) => {
    const k = v / BASE.scale;
    TUNING.sprite.scale = v;
    TUNING.hitbox.width = BASE.hitboxW * k;
    TUNING.hitbox.height = BASE.hitboxH * k;
    TUNING.shadow.radiusX = BASE.shadowX * k;
    TUNING.shadow.radiusY = BASE.shadowY * k;
    scene.resizeHitbox();
  });
  bindNumber('speed', 'speed-val', (v) => { TUNING.move.walkSpeed = v; });
  bindNumber('fpsmax', 'fpsmax-val', (v) => { TUNING.anim.walkFpsMax = v; });

  ($('t-auto') as HTMLInputElement).addEventListener('change', (e) => {
    scene.setAutoWalk((e.target as HTMLInputElement).checked);
  });
  $('reset').addEventListener('click', () => scene.resetPlayer());
  $('export').addEventListener('click', () => void exportConfig());

  function bindNumber(id: string, out: string, apply: (v: number) => void): void {
    const slider = $(id) as HTMLInputElement;
    const label = $(out);
    const push = () => { apply(Number(slider.value)); label.textContent = slider.value; };
    slider.addEventListener('input', push);
    push();
  }
}

/** Складывает подвижку с текущим photo-config.json и печатает готовый кусок */
async function exportConfig(): Promise<void> {
  const out = document.getElementById('export-out') as HTMLTextAreaElement;
  try {
    const cfg = await (await fetch('/scripts/photo-config.json')).json();
    for (const frame of cfg.frames) {
      const nudge = FRAME_NUDGE[frame.name];
      if (!nudge) continue;
      frame.offsetX = Math.round((frame.offsetX ?? 0) + nudge.x);
      frame.offsetY = Math.round((frame.offsetY ?? 0) + nudge.y);
    }
    out.value = '"frames": ' + JSON.stringify(cfg.frames, null, 2)
      + '\n\n// вставь вместо блока "frames" в scripts/photo-config.json и запусти npm run photos';
  } catch {
    out.value = 'Не смог прочитать photo-config.json. Прибавь вручную к offsetX/offsetY:\n'
      + JSON.stringify(FRAME_NUDGE, null, 2);
  }
  out.select();
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#20202e',
  pixelArt: false,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: TestScene,
});

// чтобы можно было залезть в игрока из консоли браузера: game.scene.getScene('test')
(window as unknown as { game: Phaser.Game }).game = game;
