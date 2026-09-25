/** Точка входа игры. */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultScene } from './scenes/ResultScene';
import { MAX_VIEW_W, VIEW_H, VIEW_W } from './systems/Textures';

const parent = document.getElementById('game')!;

/** Ширина игры под пропорции экрана: высота всегда VIEW_H, по бокам не остаётся полос */
function fitWidth(): number {
  const aspect = parent.clientWidth / Math.max(1, parent.clientHeight);
  return Phaser.Math.Clamp(Math.round(VIEW_H * aspect), VIEW_W, MAX_VIEW_W);
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: fitWidth(),
  height: VIEW_H,
  backgroundColor: '#1b1a26',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // по умолчанию Phaser ловит одно касание; нужно три: джойстик + прыжок + рывок
  input: { activePointers: 3 },
  physics: {
    default: 'arcade',
    // гравитация задаётся каждому телу отдельно — так проще крутить в tuning.ts
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, PauseScene, ResultScene],
});

// поворот телефона, панели браузера появились или спрятались
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const width = fitWidth();
    if (width !== game.scale.width) game.scale.setGameSize(width, VIEW_H);
  }, 100);
});

// удобно лезть в сцены из консоли браузера
(window as unknown as { game: Phaser.Game }).game = game;
