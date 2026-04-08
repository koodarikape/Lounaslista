import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  maxDuration: 60,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const { handleMenuRoutes } = await import('../menu-api-routes.ts')
    const url = new URL(req.url || '/', 'http://localhost')
    const ok = await handleMenuRoutes(url.pathname, url.searchParams, res)
    if (!ok) {
      res.status(404).end('Not found')
    }
  } catch (e) {
    console.error('api/menu', e)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          kind: 'error',
          message: 'Palvelinvirhe (lounaslista).',
        }),
      )
    }
  }
}
