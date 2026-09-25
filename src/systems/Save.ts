/** Прогресс и настройки в localStorage. Ничего серверного, всё локально. */

const KEY = 'super-mashio-save-v1';

export interface LevelResult {
  best: number;
  stars: number;
}

export interface SaveData {
  levels: Record<number, LevelResult>;
  unlocked: number;
  muted: boolean;
}

const EMPTY: SaveData = { levels: {}, unlocked: 1, muted: false };

function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, levels: {} };
    return { ...EMPTY, ...JSON.parse(raw) as SaveData };
  } catch {
    return { ...EMPTY, levels: {} };
  }
}

function write(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // приватный режим или переполнение — просто играем без сохранения
  }
}

export const Save = {
  all(): SaveData {
    return read();
  },

  result(level: number): LevelResult {
    return read().levels[level] ?? { best: 0, stars: 0 };
  },

  /** Записывает результат, если он лучше прежнего, и открывает следующий уровень */
  finishLevel(level: number, score: number, stars: number): void {
    const data = read();
    const prev = data.levels[level] ?? { best: 0, stars: 0 };
    data.levels[level] = {
      best: Math.max(prev.best, score),
      stars: Math.max(prev.stars, stars),
    };
    data.unlocked = Math.max(data.unlocked, Math.min(level + 1, 3));
    write(data);
  },

  isMuted(): boolean {
    return read().muted;
  },

  setMuted(muted: boolean): void {
    const data = read();
    data.muted = muted;
    write(data);
  },

  reset(): void {
    write({ ...EMPTY, levels: {} });
  },
};
