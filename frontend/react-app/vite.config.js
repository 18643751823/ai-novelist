import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({
    include: ['**/*.jsx', '**/*.js'] // 让 Vite 也处理 .js 文件中的 JSX
  })],
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'build',
    sourcemap: true
  },
  define: {
    'process.env': {}
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: []
  }
})