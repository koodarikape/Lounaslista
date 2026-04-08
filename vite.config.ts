import { defineConfig } from 'vite'
import { createMenuApiMiddleware } from './menu-api.ts'

const menuApi = createMenuApiMiddleware()

export default defineConfig({
  plugins: [
    {
      name: 'menu-api',
      configureServer(server) {
        server.middlewares.use(menuApi)
      },
      configurePreviewServer(server) {
        server.middlewares.use(menuApi)
      },
    },
  ],
})
