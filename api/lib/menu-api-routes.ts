import type { MenuScope } from './menu-extract.ts'

function parseScope(s: string | null): MenuScope {
  return s === 'today' ? 'today' : 'week'
}

/** Yhteensopiva Node ServerResponse / VercelResponse kanssa. */
export type ApiResponseLike = {
  statusCode: number
  setHeader(name: string, value: string | number | readonly string[]): void
  end(chunk?: string | Uint8Array): void
}

function normalizePath(pathname: string): string {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/menus') return '/api/menus'
  if (path === '/menu') return '/api/menu'
  return path
}

let menuExtractPromise: Promise<typeof import('./menu-extract.js')> | null = null

function loadMenuExtract() {
  if (!menuExtractPromise) {
    menuExtractPromise = import('./menu-extract.js')
  }
  return menuExtractPromise
}

/**
 * Palauttaa true jos pyyntö oli /api/* ja vastaus kirjoitettiin.
 * Dynaaminen import: Vercel ei saa ladata cheerio/pdf-ketjua ennen kuin pyyntö tulee.
 */
export async function handleMenuRoutes(
  pathname: string,
  searchParams: URLSearchParams,
  res: ApiResponseLike,
): Promise<boolean> {
  const path = normalizePath(pathname)
  const { getAllMenus, getMenuForRestaurant } = await loadMenuExtract()

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

  return false
}
