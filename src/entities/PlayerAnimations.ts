/**
 * Одно место, где описаны все кадры и анимации игрока.
 * Досняли новый кадр — дописали его в PLAYER_FRAMES и в нужную анимацию, и всё.
 */

import Phaser from 'phaser';

export const PLAYER_TEXTURE = 'player';

/** Кадры, которые ждём в атласе public/assets/player/player.json */
export const PLAYER_FRAMES = {
  idle: 'idle',
  step1: 'step1',
  step2: 'step2',
  jump: 'jump',
  // сюда добавляются будущие кадры: fall, win, ...
} as const;

export type PlayerFrameName = keyof typeof PLAYER_FRAMES;

export interface PlayerAnimDef {
  key: string;
  frames: PlayerFrameName[];
  frameRate: number;
  repeat: number;
}

/**
 * Цикл ходьбы намеренно идёт step1 -> idle -> step2 -> idle:
 * кадр стойки работает промежуточным контактом, и цикл получается
 * куда плавнее простого чередования двух шагов.
 */
export const PLAYER_ANIMS: PlayerAnimDef[] = [
  { key: 'player-idle', frames: ['idle'], frameRate: 1, repeat: -1 },
  { key: 'player-walk', frames: ['step1', 'idle', 'step2', 'idle'], frameRate: 10, repeat: -1 },
  { key: 'player-jump', frames: ['jump'], frameRate: 1, repeat: -1 },
  { key: 'player-fall', frames: ['jump'], frameRate: 1, repeat: -1 },
  { key: 'player-dash', frames: ['step2'], frameRate: 1, repeat: -1 },
];

/**
 * Ручная доводка кадров прямо в игре, в пикселях исходного кадра атласа.
 * Нужна, когда автоматическое выравнивание в prepare_photos.py чуть промахнулось:
 * подкрутил на тестовой странице -> перенёс числа в scripts/photo-config.json.
 */
export const FRAME_NUDGE: Record<string, { x: number; y: number }> = {
  idle: { x: 0, y: 0 },
  step1: { x: 0, y: 0 },
  step2: { x: 0, y: 0 },
  jump: { x: 0, y: 0 },
};

/** Регистрирует все анимации в сцене. Вызывать один раз после загрузки атласа. */
export function registerPlayerAnimations(scene: Phaser.Scene): void {
  for (const def of PLAYER_ANIMS) {
    if (scene.anims.exists(def.key)) continue;
    scene.anims.create({
      key: def.key,
      frames: def.frames.map((name) => ({ key: PLAYER_TEXTURE, frame: PLAYER_FRAMES[name] })),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  }
}

/** Частота цикла ходьбы, привязанная к скорости: чем быстрее бежит, тем быстрее шаги. */
export function walkFrameRate(speed: number, min: number, max: number, speedRef: number): number {
  const t = Phaser.Math.Clamp(Math.abs(speed) / speedRef, 0, 1);
  return Phaser.Math.Linear(min, max, t);
}
