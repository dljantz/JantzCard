import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base is '/' because you are using a custom domain (jantzcard.com).
  // If you were not using a custom domain, this would be '/<repo-name>/'
  base: '/',
})