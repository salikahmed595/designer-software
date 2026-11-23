import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { productionBridge } from './server/plugin';

export default defineConfig({
  plugins: [react(), productionBridge()],
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/production/jobs/**', '**/test-results/**'] } },
});
