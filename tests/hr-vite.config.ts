// Dedicated loopback-only preview: no .env loading and no production proxy.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins:[react()],envDir:false,
  resolve:{alias:{'@':path.resolve(process.cwd(),'src')}},
  define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api'),'import.meta.env.VITE_REMOTE_READ_ONLY':JSON.stringify('false')},
  server:{host:'127.0.0.1',port:5174,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:55484',changeOrigin:true},'/ws':{target:'http://127.0.0.1:55484',changeOrigin:true,ws:true}}},
});
