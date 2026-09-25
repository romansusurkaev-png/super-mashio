/** Реестр уровней. Добавил level2.json — дописал сюда одну строку. */

import level1 from './level1.json';
import level2 from './level2.json';
import type { LevelDef } from './types';

export const LEVELS: Record<number, LevelDef> = {
  1: level1 as LevelDef,
  2: level2 as LevelDef,
};

/** Что показывать в меню, даже если уровень ещё не сделан */
export const LEVEL_CARDS: Array<{ id: number; name: string; cat: string; palette: string }> = [
  { id: 1, name: 'Двор', cat: 'Ахчи', palette: 'yard' },
  { id: 2, name: 'Кухня', cat: 'Тиша', palette: 'kitchen' },
  { id: 3, name: 'Крыши', cat: 'Дворовые', palette: 'roofs' },
];
