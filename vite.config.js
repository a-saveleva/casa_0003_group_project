import { defineConfig } from 'vite'
import ghPages from 'vite-plugin-gh-pages'

export default defineConfig({
  base: '/casa_0003_group_project/',
  plugins: [ghPages()]
});