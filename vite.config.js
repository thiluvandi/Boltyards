import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// two pages: the landing/game site and the contact page
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        contact: fileURLToPath(new URL('./contact.html', import.meta.url)),
      },
    },
  },
});
