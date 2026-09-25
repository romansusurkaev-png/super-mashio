// Обёртка над scripts/prepare_photos.py — то, что вызывается через `npm run photos`.
//
// Зачем так: вся тяжёлая работа с картинками (вырезание фона, выравнивание,
// стилизация) делается на Python — там есть Pillow, numpy и scipy, и это
// заметно короче и надёжнее, чем то же самое на Node.
// Скрипт умеет:
//   - подобрать интерпретатор Python (python / py -3 / python3);
//   - подхватить свежие фото из корня проекта (1.png..4.png) в photos/;
//   - объяснить, чего не хватает, если Python или библиотек нет.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PHOTOS = path.join(ROOT, 'photos');
const SCRIPT = path.join(ROOT, 'scripts', 'prepare_photos.py');

// --- 1. свежие кадры из корня проекта -> photos/01.png..04.png
function syncSourcePhotos() {
  fs.mkdirSync(PHOTOS, { recursive: true });
  let copied = 0;
  for (let i = 1; i <= 12; i++) {
    const padded = String(i).padStart(2, '0');
    const target = path.join(PHOTOS, `${padded}.png`);
    for (const candidate of [`${i}.png`, `${padded}.png`]) {
      const source = path.join(ROOT, candidate);
      if (!fs.existsSync(source)) continue;
      const fresh = !fs.existsSync(target)
        || fs.statSync(source).mtimeMs > fs.statSync(target).mtimeMs;
      if (fresh) {
        fs.copyFileSync(source, target);
        console.log(`  подхватил ${candidate} -> photos/${padded}.png`);
        copied++;
      }
      break;
    }
  }
  if (copied === 0) console.log('  новых кадров в корне проекта нет');
}

// --- 2. поиск python
function findPython() {
  const variants = [
    ['python', []],
    ['python3', []],
    ['py', ['-3']],
  ];
  for (const [cmd, prefix] of variants) {
    const probe = spawnSync(cmd, [...prefix, '--version'], { encoding: 'utf8' });
    if (probe.status === 0) return { cmd, prefix };
  }
  return null;
}

console.log('SUPER MASHIO — подготовка кадров игрока');
syncSourcePhotos();

const python = findPython();
if (!python) {
  console.error('\nНе нашёл Python. Поставь Python 3.10+ и повтори:');
  console.error('  winget install Python.Python.3.12');
  process.exit(1);
}

const args = [...python.prefix, SCRIPT, ...process.argv.slice(2)];
const run = spawnSync(python.cmd, args, {
  stdio: 'inherit',
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});

if (run.status !== 0) {
  console.error('\nЕсли ругается на импорты — доставь библиотеки:');
  console.error('  python -m pip install pillow numpy scipy');
  process.exit(run.status ?? 1);
}
