import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const remoteApiTarget = env.VITE_REMOTE_API_TARGET;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: remoteApiTarget
      ? {
          proxy: {
            '/ws': { target: remoteApiTarget, changeOrigin: true, secure: true, ws: true },
            '/api': {
              target: remoteApiTarget,
              changeOrigin: true,
              secure: true,
              ws: true,
              configure: (proxy) => {
                proxy.on('proxyRes', (proxyResponse) => {
                  const cookies = proxyResponse.headers['set-cookie'];
                  if (cookies) {
                    proxyResponse.headers['set-cookie'] = cookies.map((cookie) =>
                      cookie.replace(/;\s*Secure/gi, '').replace(/;\s*Domain=[^;]*/gi, ''),
                    );
                  }
                });
              },
            },
            '/uploads': {
              target: remoteApiTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : undefined,
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-tooltip'],
          },
        },
      },
    },
  };
});
