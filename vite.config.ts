import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, open: '/test-player.html' },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // две страницы: сама игра и отладочный стенд персонажа
      input: {
        main: 'index.html',
        testPlayer: 'test-player.html',
      },
    },
  },
});
