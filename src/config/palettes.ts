/** Палитры уровней. Один уровень — один набор цветов, отсюда красится всё: фон, земля, частицы, HUD. */

/** Набор рисовалок фона и декора. Уровень выбирает тему через палитру. */
export type Theme = 'yard' | 'kitchen' | 'roofs';

export interface Palette {
  /** какими рисовалками собирать фон и декор */
  theme: Theme;
  /** небо: цвет сверху и снизу */
  sky: [number, number];
  /** свет на горизонте (закат/лампа) */
  glow: number;
  /** три слоя параллакса от дальнего к ближнему */
  far: number;
  mid: number;
  near: number;
  /** земля */
  ground: number;
  groundTop: number;
  groundEdge: number;
  /** акцент интерфейса и подсветок */
  accent: number;
  /** лёгкий тон на фото-персонаже, чтобы не выпадал из сцены */
  playerTint: number;
  /** цвет пылинок/светлячков в воздухе */
  motes: number;
  /** что летает в воздухе */
  ambient: 'fireflies' | 'dust' | 'feathers';
}

export const PALETTES: Record<string, Palette> = {
  /** Двор, летние сумерки */
  yard: {
    theme: 'yard',
    sky: [0x2c3a63, 0xf2a25c],
    glow: 0xffb877,
    far: 0x364473,
    mid: 0x2f3a63,
    near: 0x232b4d,
    ground: 0x3b7a4a,
    groundTop: 0x4e9a5b,
    groundEdge: 0x2a5537,
    accent: 0xffd166,
    playerTint: 0xf2d9c8,
    motes: 0xffe68a,
    ambient: 'fireflies',
  },

  /** Кухня, тёплый вечер */
  kitchen: {
    theme: 'kitchen',
    sky: [0xf5e0c3, 0xe0b489],
    glow: 0xffb870,
    far: 0xd9b48c,
    mid: 0xc98b5e,
    near: 0x8a5a3b,
    ground: 0x9c6440,
    groundTop: 0xc98b5e,
    groundEdge: 0x6d4429,
    accent: 0xff8a5b,
    playerTint: 0xffe9cf,
    motes: 0xfff0d0,
    ambient: 'dust',
  },

  /** Крыши, закат */
  roofs: {
    theme: 'roofs',
    sky: [0x6b4b8a, 0xff9e6d],
    glow: 0xffd39b,
    far: 0x8a6a9e,
    mid: 0x5c4a72,
    near: 0x3a3550,
    ground: 0xc1584e,
    groundTop: 0xd86a5c,
    groundEdge: 0x8d3d38,
    accent: 0xffe1a8,
    playerTint: 0xffd9c6,
    motes: 0xffe1a8,
    ambient: 'feathers',
  },
};

export function getPalette(key: string): Palette {
  return PALETTES[key] ?? PALETTES.yard;
}
