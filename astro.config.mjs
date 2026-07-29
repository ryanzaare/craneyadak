// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // ⚠️ حیاتی برای سئو: بدون این، canonical و sitemap آدرس درست تولید نمی‌کنند
  site: 'https://craneyadak.com',

  build: {
    inlineStylesheets: 'auto',
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
