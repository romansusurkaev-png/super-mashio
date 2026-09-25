/** Ждём шрифты Google, чтобы текст не мигал системным, и уходим в загрузку. */

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const go = () => this.scene.start('preload');

    if (document.fonts?.ready) {
      // на всякий случай не ждём дольше полутора секунд
      const timeout = this.time.delayedCall(1500, go);
      void document.fonts.ready.then(() => {
        timeout.remove();
        go();
      });
    } else {
      go();
    }
  }
}
