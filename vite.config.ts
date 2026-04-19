import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/feishu-bitable-pdf-multi-export/',  // GitHub Pages 路径，必须和仓库名一致
})
