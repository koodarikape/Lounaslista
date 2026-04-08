import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleMenuRoutes } from './api/lib/menu-api-routes.ts'

export function createMenuApiMiddleware() {
  return async function menuApi(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> {
    const rawUrl = req.url ?? ''
    if (!rawUrl.startsWith('/api/')) {
      next()
      return
    }
    const u = new URL(rawUrl, 'http://localhost')
    const handled = await handleMenuRoutes(u.pathname, u.searchParams, res)
    if (!handled) {
      next()
    }
  }
}
