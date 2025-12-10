
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // This makes the Netlify 'API_KEY' available as 'import.meta.env.VITE_API_KEY' in the code
      'import.meta.env.VITE_API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});
