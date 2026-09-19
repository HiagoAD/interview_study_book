import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { content, katexWoff2Only } from './pipeline/vite-plugin.ts'

export default defineConfig({
  plugins: [react(), content(), katexWoff2Only(), viteSingleFile()],
})
