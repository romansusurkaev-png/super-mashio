/**
 * Процедурная векторная графика: небо, слои параллакса, декор, частицы.
 * Рисуем один раз в текстуры на канвасе — дальше это обычные картинки,
 * и сцена не тратит ничего на перерисовку.
 */

import Phaser from 'phaser';
import type { Palette } from '../config/palettes';

/** SVG грузятся в двойном размере ради чёткости — рисуем их вполовину */
export const SVG_SCALE = 0.5;

/** Высота игры всегда VIEW_H, а ширина подстраивается под экран: от VIEW_W (16:9)
 *  до MAX_VIEW_W (≈ 2.6:1, телефон боком). Текущая ширина — scene.scale.width. */
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const MAX_VIEW_W = 1880;

/** Зовёт fn, когда меняется ширина игры (поворот телефона, панели браузера) */
export function onWidthChange(scene: Phaser.Scene, fn: (width: number) => void): void {
  let last = scene.scale.width;
  const handler = (gameSize: Phaser.Structs.Size) => {
    if (gameSize.width === last) return;
    last = gameSize.width;
    fn(last);
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, handler));
}

/** 0x336699 -> '#336699' */
export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** Смешивает два цвета: t = 0 даёт a, t = 1 даёт b */
export function mix(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  return Phaser.Display.Color.GetColor(
    Math.round(Phaser.Math.Linear(ca.red, cb.red, t)),
    Math.round(Phaser.Math.Linear(ca.green, cb.green, t)),
    Math.round(Phaser.Math.Linear(ca.blue, cb.blue, t)),
  );
}

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: Painter): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) return;
  draw(canvas.getContext(), w, h);
  canvas.refresh();
}

// ---------------------------------------------------------------- общие мелочи

/** Мягкая точка — из неё сделаны все частицы */
export function makeParticleTextures(scene: Phaser.Scene): void {
  paint(scene, 'soft-dot', 48, 48, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });

  paint(scene, 'spark', 32, 32, (ctx, w) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const c = w / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? c : c * 0.32;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });

  paint(scene, 'kibble', 16, 16, (ctx, w) => {
    ctx.fillStyle = '#C07C42';
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E0A268';
    ctx.beginPath();
    ctx.arc(w / 2 - 2, w / 2 - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---------------------------------------------------------------- фон уровня

/** Небо: вертикальный градиент плюс тёплое зарево у горизонта */
function paintSky(scene: Phaser.Scene, key: string, p: Palette): void {
  paint(scene, key, VIEW_W, VIEW_H, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, hex(p.sky[0]));
    g.addColorStop(1, hex(p.sky[1]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w * 0.72, h * 0.78, 0, w * 0.72, h * 0.78, h * 0.75);
    glow.addColorStop(0, hex(p.glow) + 'aa');
    glow.addColorStop(1, hex(p.glow) + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Дальний слой: во дворе дома и деревья, на кухне полки с банками */
function paintFar(scene: Phaser.Scene, key: string, p: Palette): void {
  paint(scene, key, VIEW_W, 340, (ctx, w, h) => {
    if (p.theme === 'kitchen') { farKitchen(ctx, w, h, p); return; }
    ctx.fillStyle = hex(p.far);
    let x = 40;
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

    while (x < w - 120) {
      const bw = 90 + rnd() * 110;
      const bh = 110 + rnd() * 130;
      const y = h - bh;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, y + 24);
      ctx.lineTo(x + bw / 2, y);
      ctx.lineTo(x + bw, y + 24);
      ctx.lineTo(x + bw, h);
      ctx.closePath();
      ctx.fill();

      // окошки со светом
      ctx.fillStyle = hex(mix(p.far, p.glow, 0.55));
      for (let i = 0; i < 3; i++) {
        if (rnd() > 0.45) {
          ctx.fillRect(x + 16 + i * 26, y + 46 + Math.floor(rnd() * 2) * 34, 15, 20);
        }
      }
      ctx.fillStyle = hex(p.far);
      x += bw + 30 + rnd() * 60;
    }

    // кроны деревьев между домами
    for (let i = 0; i < 7; i++) {
      const cx = 90 + i * 180 + rnd() * 40;
      const cy = h - 70 - rnd() * 40;
      const r = 44 + rnd() * 26;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx - r * 0.7, cy + 14, r * 0.7, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.7, cy + 14, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 7, cy, 14, h - cy);
    }
  });
}

/** Средний слой: гаражи или навесные шкафы */
function paintMid(scene: Phaser.Scene, key: string, p: Palette): void {
  paint(scene, key, VIEW_W, 300, (ctx, w, h) => {
    if (p.theme === 'kitchen') { midKitchen(ctx, w, h, p); return; }
    let x = 20;
    let seed = 31;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

    while (x < w - 100) {
      const bw = 150 + rnd() * 90;
      const bh = 110 + rnd() * 60;
      const y = h - bh;

      ctx.fillStyle = hex(p.mid);
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 22);
      ctx.lineTo(x + bw / 2, y);
      ctx.lineTo(x + bw + 12, y + 22);
      ctx.lineTo(x + bw, y + 30);
      ctx.lineTo(x, y + 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x, y + 26, bw, bh);

      // ворота
      ctx.fillStyle = hex(mix(p.mid, 0x000000, 0.22));
      ctx.fillRect(x + 22, y + 58, bw - 44, bh - 58);
      ctx.fillStyle = hex(mix(p.mid, p.accent, 0.18));
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 26, y + 66 + i * 18, bw - 52, 6);

      x += bw + 26 + rnd() * 50;
    }
  });
}

/** Ближний слой: забор с кустами или столешница с банками */
function paintNear(scene: Phaser.Scene, key: string, p: Palette): void {
  paint(scene, key, VIEW_W, 240, (ctx, w, h) => {
    if (p.theme === 'kitchen') { nearKitchen(ctx, w, h, p); return; }
    ctx.fillStyle = hex(p.near);
    // штакетник
    for (let x = 0; x < w; x += 34) {
      const top = h - 128 - (x % 68 === 0 ? 6 : 0);
      ctx.beginPath();
      ctx.moveTo(x + 4, h);
      ctx.lineTo(x + 4, top + 12);
      ctx.lineTo(x + 15, top);
      ctx.lineTo(x + 26, top + 12);
      ctx.lineTo(x + 26, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(0, h - 96, w, 12);
    ctx.fillRect(0, h - 46, w, 12);

    // кусты поверх забора
    ctx.fillStyle = hex(mix(p.near, p.ground, 0.45));
    let seed = 5;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 9; i++) {
      const cx = 60 + i * 145 + rnd() * 50;
      const r = 40 + rnd() * 22;
      ctx.beginPath();
      ctx.arc(cx, h - 18, r, Math.PI, 0);
      ctx.arc(cx - r * 0.62, h - 10, r * 0.62, Math.PI, 0);
      ctx.arc(cx + r * 0.62, h - 10, r * 0.66, Math.PI, 0);
      ctx.fill();
    }
  });
}

/** Виньетка поверх сцены — на случай, если PostFX недоступен */
export function makeVignette(scene: Phaser.Scene): void {
  paint(scene, 'vignette', MAX_VIEW_W, VIEW_H, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.92);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// ---------------------------------------------------------------- декор

export function makeDecorTextures(scene: Phaser.Scene, p: Palette, prefix: string): void {
  if (p.theme === 'kitchen') { decorKitchen(scene, p, prefix); return; }
  const dark = hex(mix(p.ground, 0x1a1226, 0.55));

  paint(scene, `${prefix}-bush`, 190, 130, (ctx, w, h) => {
    ctx.fillStyle = dark;
    blob(ctx, w / 2, h - 6, 84, 62, 5);
    ctx.fillStyle = hex(p.ground);
    blob(ctx, w / 2, h - 12, 78, 56, 5);
    ctx.fillStyle = hex(mix(p.ground, p.groundTop, 0.8));
    blob(ctx, w / 2 - 14, h - 34, 44, 30, 4);
  });

  paint(scene, `${prefix}-tree`, 250, 320, (ctx, w, h) => {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, h);
    ctx.quadraticCurveTo(w / 2 - 10, h - 110, w / 2 - 14, h - 170);
    ctx.lineTo(w / 2 + 14, h - 170);
    ctx.quadraticCurveTo(w / 2 + 10, h - 110, w / 2 + 20, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(mix(p.ground, 0x000000, 0.15));
    blob(ctx, w / 2, h - 210, 108, 84, 6);
    ctx.fillStyle = hex(p.ground);
    blob(ctx, w / 2 + 6, h - 220, 96, 74, 6);
    ctx.fillStyle = hex(mix(p.ground, p.groundTop, 0.75));
    blob(ctx, w / 2 - 26, h - 244, 50, 36, 5);
  });

  paint(scene, `${prefix}-fence`, 230, 130, (ctx, w, h) => {
    ctx.fillStyle = hex(mix(p.near, p.groundTop, 0.25));
    for (let x = 6; x < w - 20; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, 22);
      ctx.lineTo(x + 13, 8);
      ctx.lineTo(x + 26, 22);
      ctx.lineTo(x + 26, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(0, 40, w, 13);
    ctx.fillRect(0, 88, w, 13);
  });

  paint(scene, `${prefix}-lamp`, 110, 330, (ctx, w, h) => {
    ctx.fillStyle = dark;
    ctx.fillRect(w / 2 - 8, 70, 16, h - 70);
    ctx.fillRect(w / 2 - 26, h - 14, 52, 14);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 30, 70);
    ctx.lineTo(w / 2 + 30, 70);
    ctx.lineTo(w / 2 + 18, 34);
    ctx.lineTo(w / 2 - 18, 34);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createRadialGradient(w / 2, 66, 4, w / 2, 66, 62);
    g.addColorStop(0, hex(p.accent) + 'ee');
    g.addColorStop(1, hex(p.accent) + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 4, w, 130);
  });

  paint(scene, `${prefix}-box`, 130, 110, (ctx, w, h) => {
    ctx.fillStyle = dark;
    roundRect(ctx, 4, 8, w - 8, h - 12, 10);
    ctx.fill();
    ctx.fillStyle = hex(mix(p.near, p.accent, 0.35));
    roundRect(ctx, 10, 14, w - 20, h - 24, 8);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(w / 2 - 5, 14, 10, h - 24);
  });

  paint(scene, `${prefix}-flowers`, 150, 90, (ctx, _w, h) => {
    ctx.strokeStyle = hex(mix(p.ground, 0x000000, 0.2));
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const spots = [30, 62, 96, 124];
    for (let i = 0; i < spots.length; i++) {
      const x = spots[i];
      const top = h - 34 - (i % 2) * 18;
      ctx.beginPath();
      ctx.moveTo(x, h - 4);
      ctx.quadraticCurveTo(x + 8, h - 30, x, top);
      ctx.stroke();
      ctx.fillStyle = i % 2 ? hex(p.accent) : hex(p.motes);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 8, top + Math.sin(a) * 8, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Пузатая «облачная» клякса — базовая форма всей растительности */
function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number,
              rx: number, ry: number, lobes: number): void {
  ctx.beginPath();
  for (let i = 0; i <= lobes; i++) {
    const t = i / lobes;
    const a = Math.PI + t * Math.PI;
    const r = rx * (0.72 + 0.28 * Math.sin(t * Math.PI * 2.2));
    ctx.arc(cx + Math.cos(a) * rx * 0.62, cy + Math.sin(a) * ry * 0.55, r * 0.42, 0, Math.PI * 2);
  }
  ctx.ellipse(cx, cy - ry * 0.2, rx * 0.82, ry * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number,
                   w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}


// ---------------------------------------------------------------- кухня

/** Дальний слой: две полки вдоль стены, на них банки */
function farKitchen(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const board = hex(mix(p.far, 0x000000, 0.28));

  for (const shelfY of [h - 250, h - 120]) {
    for (let x = 26; x < w - 70; x += 46 + rnd() * 40) {
      const jw = 22 + rnd() * 22;
      const jh = 38 + rnd() * 54;
      ctx.fillStyle = hex(mix(p.far, p.glow, 0.18 + rnd() * 0.32));
      roundRect(ctx, x, shelfY - jh, jw, jh, 6);
      ctx.fill();
      ctx.fillStyle = board;
      ctx.fillRect(x + 2, shelfY - jh - 7, jw - 4, 8);
    }
    ctx.fillStyle = board;
    ctx.fillRect(0, shelfY, w, 14);
    ctx.fillStyle = hex(mix(p.far, 0x000000, 0.45));
    ctx.fillRect(0, shelfY + 14, w, 5);
  }
}

/** Средний слой: ряд навесных шкафов. Ширина делится нацело, поэтому шва не видно */
function midKitchen(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  const count = 8;
  const unit = w / count;
  const top = h - 210;

  ctx.fillStyle = hex(p.mid);
  ctx.fillRect(0, top, w, 200);
  ctx.fillStyle = hex(mix(p.mid, 0x000000, 0.38));
  ctx.fillRect(0, top + 200, w, 12);

  for (let i = 0; i < count; i++) {
    const x = i * unit;
    ctx.fillStyle = hex(mix(p.mid, p.glow, 0.14));
    roundRect(ctx, x + 10, top + 14, unit - 20, 172, 10);
    ctx.fill();
    ctx.fillStyle = hex(mix(p.mid, 0x000000, 0.26));
    roundRect(ctx, x + 26, top + 30, unit - 52, 140, 8);
    ctx.fill();
    ctx.fillStyle = hex(mix(p.mid, 0xffffff, 0.5));
    roundRect(ctx, x + unit / 2 - 5, top + 146, 10, 28, 5);
    ctx.fill();
  }
}

/** Ближний слой: столешница, на ней банки, бутылки и доска */
function nearKitchen(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  let seed = 3;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const slabTop = h - 74;

  for (let x = 30; x < w - 110; x += 118 + rnd() * 96) {
    const kind = Math.floor(rnd() * 3);
    ctx.fillStyle = hex(mix(p.near, p.glow, 0.3 + rnd() * 0.28));
    if (kind === 0) {
      const jh = 64 + rnd() * 44;
      roundRect(ctx, x, slabTop - jh, 46, jh, 10);
      ctx.fill();
      ctx.fillStyle = hex(mix(p.near, 0x000000, 0.35));
      ctx.fillRect(x + 4, slabTop - jh - 10, 38, 11);
    } else if (kind === 1) {
      const bh = 104 + rnd() * 44;
      roundRect(ctx, x + 6, slabTop - bh * 0.55, 34, bh * 0.55, 9);
      ctx.fill();
      ctx.fillRect(x + 16, slabTop - bh, 14, bh * 0.5);
      ctx.fillStyle = hex(mix(p.near, 0x000000, 0.35));
      ctx.fillRect(x + 14, slabTop - bh - 6, 18, 8);
    } else {
      roundRect(ctx, x, slabTop - 92, 52, 92, 16);
      ctx.fill();
    }
  }

  ctx.fillStyle = hex(mix(p.near, p.groundTop, 0.4));
  ctx.fillRect(0, slabTop, w, 26);
  ctx.fillStyle = hex(p.near);
  ctx.fillRect(0, slabTop + 26, w, h - slabTop - 26);
}

/** Декор кухни: банка, бутылка, кружка, растение, лампа, хлебница */
function decorKitchen(scene: Phaser.Scene, p: Palette, prefix: string): void {
  const dark = hex(mix(p.ground, 0x2a1a12, 0.55));
  const light = hex(mix(p.groundTop, 0xffffff, 0.35));

  paint(scene, prefix + '-jar', 110, 150, (ctx, w, h) => {
    ctx.fillStyle = dark;
    roundRect(ctx, 16, 30, w - 32, h - 34, 20); ctx.fill();
    ctx.fillStyle = hex(mix(p.groundTop, p.glow, 0.45));
    roundRect(ctx, 22, 36, w - 44, h - 46, 16); ctx.fill();
    ctx.fillStyle = hex(mix(p.accent, 0xffffff, 0.25));
    roundRect(ctx, 30, 74, w - 60, h - 88, 10); ctx.fill();
    ctx.fillStyle = dark;
    roundRect(ctx, 10, 8, w - 20, 30, 10); ctx.fill();
    ctx.fillStyle = light;
    roundRect(ctx, 34, 52, 12, 46, 6); ctx.fill();
  });

  paint(scene, prefix + '-bottle', 90, 210, (ctx, w, h) => {
    ctx.fillStyle = dark;
    roundRect(ctx, 14, 78, w - 28, h - 82, 20); ctx.fill();
    ctx.fillRect(w / 2 - 17, 22, 34, 66);
    roundRect(ctx, w / 2 - 21, 6, 42, 24, 8); ctx.fill();
    ctx.fillStyle = hex(mix(p.near, p.glow, 0.5));
    roundRect(ctx, 20, 84, w - 40, h - 94, 16); ctx.fill();
    ctx.fillRect(w / 2 - 12, 30, 24, 58);
    ctx.fillStyle = light;
    roundRect(ctx, 28, 100, 10, 60, 5); ctx.fill();
  });

  paint(scene, prefix + '-cup', 120, 100, (ctx, w, h) => {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(w - 32, h / 2 + 4, 24, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = dark;
    roundRect(ctx, 12, 20, w - 54, h - 26, 14); ctx.fill();
    ctx.fillStyle = hex(mix(p.accent, 0xffffff, 0.4));
    roundRect(ctx, 20, 28, w - 70, h - 42, 10); ctx.fill();
  });

  paint(scene, prefix + '-plant', 160, 200, (ctx, w, h) => {
    ctx.strokeStyle = hex(mix(0x4e9a5b, 0x000000, 0.2));
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    const leaves: Array<[number, number]> = [[-42, -70], [0, -96], [44, -66]];
    for (const [dx, dy] of leaves) {
      ctx.beginPath();
      ctx.moveTo(w / 2, h - 70);
      ctx.quadraticCurveTo(w / 2 + dx * 0.4, h - 70 + dy * 0.7, w / 2 + dx, h - 70 + dy);
      ctx.stroke();
      ctx.fillStyle = hex(0x5fae66);
      ctx.beginPath();
      ctx.ellipse(w / 2 + dx, h - 70 + dy, 26, 17, dx / 90, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 46, h - 74); ctx.lineTo(w / 2 + 46, h - 74);
    ctx.lineTo(w / 2 + 34, h - 4); ctx.lineTo(w / 2 - 34, h - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = hex(mix(p.accent, 0x000000, 0.1));
    ctx.fillRect(w / 2 - 42, h - 70, 84, 16);
  });

  paint(scene, prefix + '-lamp', 150, 230, (ctx, w, h) => {
    ctx.fillStyle = dark;
    ctx.fillRect(w / 2 - 7, 92, 14, h - 110);
    roundRect(ctx, w / 2 - 36, h - 22, 72, 18, 8); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 54, 92); ctx.lineTo(w / 2 + 54, 92);
    ctx.lineTo(w / 2 + 30, 26); ctx.lineTo(w / 2 - 30, 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = hex(mix(p.accent, 0xffffff, 0.3));
    ctx.beginPath();
    ctx.moveTo(w / 2 - 46, 86); ctx.lineTo(w / 2 + 46, 86);
    ctx.lineTo(w / 2 + 25, 33); ctx.lineTo(w / 2 - 25, 33);
    ctx.closePath(); ctx.fill();
    const glow = ctx.createRadialGradient(w / 2, 96, 4, w / 2, 96, 78);
    glow.addColorStop(0, hex(p.glow) + 'dd');
    glow.addColorStop(1, hex(p.glow) + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 30, w, 150);
  });

  paint(scene, prefix + '-box', 170, 120, (ctx, w, h) => {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(6, h - 4); ctx.lineTo(6, 54);
    ctx.quadraticCurveTo(w / 2, -12, w - 6, 54);
    ctx.lineTo(w - 6, h - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = hex(mix(p.groundTop, p.glow, 0.3));
    ctx.beginPath();
    ctx.moveTo(16, h - 12); ctx.lineTo(16, 58);
    ctx.quadraticCurveTo(w / 2, 2, w - 16, 58);
    ctx.lineTo(w - 16, h - 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark;
    roundRect(ctx, w / 2 - 22, h - 46, 44, 10, 5); ctx.fill();
  });
}

/** Всё, что нужно уровню: небо, три слоя, декор */
export function buildLevelTextures(scene: Phaser.Scene, palette: Palette, prefix: string): void {
  paintSky(scene, `${prefix}-sky`, palette);
  paintFar(scene, `${prefix}-far`, palette);
  paintMid(scene, `${prefix}-mid`, palette);
  paintNear(scene, `${prefix}-near`, palette);
  makeDecorTextures(scene, palette, prefix);
}
