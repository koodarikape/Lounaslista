import {
  getAllMenus,
  getMenuForRestaurant,
  isPdfProxyAllowed,
  type MenuScope,
} from './menu-extract.ts'

function parseScope(s: string | null): MenuScope {
  return s === 'today' ? 'today' : 'week'
}

/** Yhteensopiva Node ServerResponse / VercelResponse kanssa. */
export type ApiResponseLike = {
  statusCode: number
  setHeader(name: string, value: string | number | readonly string[]): void
  end(chunk?: string | Uint8Array): void
}

/**
 * Palauttaa true jos pyyntö oli /api/* ja vastaus kirjoitettiin.
 */
export async function handleMenuRoutes(
  pathname: string,
  searchParams: URLSearchParams,
  res: ApiResponseLike,
): Promise<boolean> {
  const path = pathname.replace(/\/$/, '') || '/'

  if (path === '/api/menus') {
    const scope = parseScope(searchParams.get('scope'))
    const result = await getAllMenus(scope)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.end(JSON.stringify({ scope, items: result }))
    return true
  }

  if (path === '/api/menu') {
    const id = searchParams.get('id')
    if (!id) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ kind: 'error', message: 'Parametri id puuttuu' }))
      return true
    }
    const scope = parseScope(searchParams.get('scope'))
    const result = await getMenuForRestaurant(id, scope)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.end(JSON.stringify(result))
    return true
  }

  if (path === '/api/pdf-proxy') {
    const u = searchParams.get('u')
    if (!u) {
      res.statusCode = 400
      res.end('Parametri u puuttuu')
      return true
    }
    let target: URL
    try {
      target = new URL(u)
    } catch {
      res.statusCode = 400
      res.end('Virheellinen osoite')
      return true
    }
    if (target.protocol !== 'https:') {
      res.statusCode = 400
      res.end('Vain https')
      return true
    }
    if (!isPdfProxyAllowed(target)) {
      res.statusCode = 403
      res.end('PDF-osoite ei ole sallittu')
      return true
    }
    try {
      const upstream = await fetch(target.href, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/pdf,*/*;q=0.8',
        },
        redirect: 'follow',
      })
      if (!upstream.ok) {
        res.statusCode = 502
        res.end(`PDF ${upstream.status}`)
        return true
      }
      const ct = upstream.headers.get('content-type') ?? 'application/pdf'
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.statusCode = 200
      res.setHeader('Content-Type', ct.includes('pdf') ? 'application/pdf' : ct)
      res.setHeader('Content-Disposition', 'inline; filename="lounaslista.pdf"')
      res.setHeader('Cache-Control', 'public, max-age=120')
      res.end(buf)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Virhe'
      res.statusCode = 502
      res.end(msg)
    }
    return true
  }

  return false
}
