import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleMenuRoutes } from '../menu-api-routes.ts'

export const config = {
  maxDuration: 60,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const url = new URL(req.url || '/', 'http://localhost')
  const ok = await handleMenuRoutes(url.pathname, url.searchParams, res)
  if (!ok) {
    res.status(404).end('Not found')
  }
}
