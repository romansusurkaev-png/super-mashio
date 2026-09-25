// Кладёт phaser.min.js из node_modules в public/vendor/,
// чтобы тестовая страница test-player.html работала без интернета и без сборки.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(ROOT, 'node_modules', 'phaser', 'dist', 'phaser.min.js');
const targetDir = path.join(ROOT, 'public', 'vendor');

if (!fs.existsSync(source)) {
  console.error('Не нашёл node_modules/phaser — сначала npm install');
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, path.join(targetDir, 'phaser.min.js'));
console.log('public/vendor/phaser.min.js обновлён');
