import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path'
import { defineConfig } from 'vite'

/** @type {import('vite').UserConfig} */
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard/index.html')
      }
    }
  },
  css: {
    devSourcemap: true,
    modules: { generateScopedName: '[hash:base64:6]' }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/assets'),
          dest: path.resolve(__dirname, 'dist')
        }
      ]
    })
  ]
})
