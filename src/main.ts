/** Точка входа игры. */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultScene } from './scenes/ResultScene';
import { VIEW_H, VIEW_W } from './systems/Textures';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
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

// удобно лезть в сцены из консоли браузера
(window as unknown as { game: Phaser.Game }).game = game;
