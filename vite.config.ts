import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

function suppressHmrSocketPlugin() {
  return {
    name: 'suppress-hmr-socket',
    transformIndexHtml: {
      order: 'pre' as const,
      handler() {
        return [
          {
            tag: 'script',
            attrs: { type: 'text/javascript' },
            children: `(function() {
  if (typeof window === 'undefined') return;
  var RealWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    var isViteHmr = (Array.isArray(protocols) ? protocols.includes('vite-hmr') : protocols === 'vite-hmr') ||
                    (typeof url === 'string' && (url.includes('token=') || url.includes('24678') || url.includes('vite-hmr')));
    if (isViteHmr) {
      var target = new EventTarget();
      var mockWs = {
        url: url,
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        send: function() {},
        close: function() {
          mockWs.readyState = 3;
          target.dispatchEvent(new Event('close'));
        },
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        dispatchEvent: target.dispatchEvent.bind(target),
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
      };
      setTimeout(function() {
        var ev = new Event('open');
        if (typeof mockWs.onopen === 'function') mockWs.onopen(ev);
        target.dispatchEvent(ev);
      }, 0);
      return mockWs;
    }
    return new RealWebSocket(url, protocols);
  };
  if (RealWebSocket) {
    window.WebSocket.prototype = RealWebSocket.prototype;
    window.WebSocket.CONNECTING = 0;
    window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSING = 2;
    window.WebSocket.CLOSED = 3;
  }
  var origConsoleError = console.error;
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    for (var i = 0; i < args.length; i++) {
      var str = String(args[i]);
      if (str.indexOf('WebSocket closed without opened') !== -1 || str.indexOf('failed to connect to websocket') !== -1) {
        return;
      }
    }
    origConsoleError.apply(console, args);
  };
  window.addEventListener('unhandledrejection', function(event) {
    if (event && event.reason && (String(event.reason).indexOf('WebSocket') !== -1 || (event.reason.message && event.reason.message.indexOf('WebSocket') !== -1))) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
})();`,
            injectTo: 'head-prepend' as const,
          },
        ];
      },
    },
  };
}

export default defineConfig(async ({ command }) => {
  const plugins: any[] = [
    suppressHmrSocketPlugin(),
    react(),
    tailwindcss(),
  ];

  if (command === 'build') {
    const { VitePWA } = await import('vite-plugin-pwa');
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'Students Support - Free Academic & Privacy Suite',
          short_name: 'Students Support',
          description: 'Zero-Retention Free Student Academic Suite (CGPA Forecaster, Rubric Blueprint, APA 7th docx Export, SM-2 Flashcards, Socratic Tutor)',
          theme_color: '#030712',
          background_color: '#030712',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        },
      })
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      hmr: false,
      watch: null,
    },
  };
});

