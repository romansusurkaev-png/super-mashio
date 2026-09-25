/** Формат уровня. Уровни — данные в JSON, а не код: правь level1.json и перезагружай страницу. */

export type PickupType = 'dry' | 'pouch' | 'can' | 'fish';
export type HazardType = 'puddle' | 'vacuum' | 'yarn' | 'icicle';

/** Сколько очков даёт каждый вид корма */
export const PICKUP_VALUE: Record<PickupType, number> = {
  dry: 1,
  pouch: 5,
  can: 10,
  fish: 25,
};

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  h: number;
  /** false — без травяной кромки сверху (полки, карнизы) */
  grass?: boolean;
}

export interface PickupDef {
  type: PickupType;
  x: number;
  y: number;
  /** дорожка одинаковых предметов: сколько штук и с каким шагом */
  count?: number;
  stepX?: number;
  stepY?: number;
  /** дугой вверх — красиво ложится над ямой */
  arc?: number;
}

export interface HazardDef {
  type: HazardType;
  x: number;
  y: number;
  /** лужа: ширина; клубок: радиус */
  w?: number;
  /** патрулирование робота-пылесоса */
  from?: number;
  to?: number;
  speed?: number;
}

export interface DecorDef {
  /** имя картинки декора; набор зависит от темы уровня (см. Textures.ts) */
  kind: string;
  x: number;
  y: number;
  scale?: number;
  /** покачивается, будто от ветра или сквозняка */
  sway?: boolean;
  /** рисуется позади игрока — деревья, лампы, крупные предметы */
  back?: boolean;
}

export interface LevelDef {
  id: number;
  name: string;
  catName: string;
  /** true — кошка, false/нет — кот. Нужно только для текста на экране результата */
  catFeminine?: boolean;
  palette: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  finish: { x: number; y: number };
  platforms: PlatformDef[];
  pickups: PickupDef[];
  hazards: HazardDef[];
  decor: DecorDef[];
  /** пороги корма на 1, 2 и 3 звезды */
  stars: [number, number, number];
}

/** Разворачивает дорожки предметов в отдельные точки */
export function expandPickups(defs: PickupDef[]): Array<{ type: PickupType; x: number; y: number }> {
  const out: Array<{ type: PickupType; x: number; y: number }> = [];
  for (const def of defs) {
    const count = def.count ?? 1;
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const arc = def.arc ? -Math.sin(t * Math.PI) * def.arc : 0;
      out.push({
        type: def.type,
        x: def.x + (def.stepX ?? 0) * i,
        y: def.y + (def.stepY ?? 0) * i + arc,
      });
    }
  }
  return out;
}
