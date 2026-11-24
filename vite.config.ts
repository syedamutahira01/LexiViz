/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function ttsProxyPlugin(): Plugin {
  const handler = async (req: any, res: any) => {
    const url = new URL(req.url!, 'http://localhost');
    const q = url.searchParams.get('q');
    const tl = url.searchParams.get('tl') || 'en';
    if (!q) {
      res.statusCode = 400;
      res.end('Missing query parameter q');
      return;
    }
    try {
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(q)}&tl=${encodeURIComponent(tl)}&client=tw-ob`;
      const resp = await fetch(googleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://translate.google.com/',
        },
      });
      if (!resp.ok) {
        res.statusCode = resp.status;
        res.end('TTS error: ' + resp.status);
        return;
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buffer = Buffer.from(await resp.arrayBuffer());
      res.end(buffer);
    } catch (e: any) {
      res.statusCode = 500;
      res.end(e?.message ?? 'TTS proxy failed');
    }
  };

  return {
    name: 'tts-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tts', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/tts', handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), ttsProxyPlugin()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
