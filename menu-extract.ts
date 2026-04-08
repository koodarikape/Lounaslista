import { load } from 'cheerio'
import { tryPdfTodayAsHtml } from './pdf-day-extract.ts'
import { restaurants } from './src/data/restaurants.ts'
import { getFiDatePatterns, getFiWeekdayLong } from './src/date-fns-fi.ts'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export type MenuScope = 'today' | 'week'

export type MenuResult =
  | { kind: 'html'; html: string }
  | { kind: 'pdf'; pdfUrl: string; variant?: 'compact' | 'full' }
  | { kind: 'error'; message: string }

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.7',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('text/html')) throw new Error('Ei HTML-vastausta')
  return res.text()
}

function sanitizeHtmlString(html: string): string {
  const $ = load(`<div id="__root">${html}</div>`)
  const root = $('#__root')
  root.find('script, link').remove()
  root.find('iframe').each((_, el) => {
    const $f = $(el)
    const src = $f.attr('src')?.trim() ?? ''
    const ok =
      /^https:\/\/docs\.google\.com\//i.test(src) ||
      /^https:\/\/drive\.google\.com\//i.test(src)
    if (!ok) {
      $f.remove()
      return
    }
    $f.addClass('menu-embed-iframe')
    $f.attr('loading', 'lazy')
    if (!$f.attr('title')) $f.attr('title', 'Lounaslista')
  })
  root.find('*').each((_, el) => {
    $(el).removeAttr('onclick').removeAttr('onload').removeAttr('onerror')
  })
  return root.html() ?? ''
}

export function extractPapasLounasPdfUrl(html: string): string | null {
  const re = /href\s*=\s*["']?(https?:\/\/[^"'\s<>]+\.pdf)/gi
  const found: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    found.push(m[1])
  }
  const preferred = found.find((u) => /lounaslista/i.test(u))
  const chosen = preferred ?? found[0]
  if (!chosen) return null
  try {
    const u = new URL(chosen)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'ravintola-papas.fi') return null
    return chosen
  } catch {
    return null
  }
}

function wrapHtmlFragment(title: string, inner: string): string {
  return `<div class="menu-extract" data-menu="1"><h3 class="menu-extract__title">${escapeHtml(title)}</h3>${inner}</div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Vilhelm: leikkaa tämän päivän kappaleet kunnes tulee seuraava päiväotsikko. */
function sliceVilhelmDay(html: string): string | null {
  const wk = getFiWeekdayLong().toLowerCase()
  const patterns = getFiDatePatterns()
  const $ = load(`<div id="__slice">${html}</div>`)
  const paras = $('#__slice').find('p').toArray()
  let startIdx = -1
  for (let i = 0; i < paras.length; i++) {
    const st = $(paras[i]).find('strong').first().text()
    const tl = st.toLowerCase()
    const dateHit = patterns.some((p) => st.includes(p) || st.includes(p.replace(/\.$/, '')))
    if (tl.includes(wk) || dateHit) {
      startIdx = i
      break
    }
  }
  if (startIdx === -1) return null
  const out = load('<div class="vilhelm-paiva"></div>')
  for (let i = startIdx; i < paras.length; i++) {
    const p = $(paras[i])
    const fst = p.find('strong').first()
    if (i > startIdx && fst.length) {
      const tx = fst.text().toLowerCase()
      if (
        /maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai/.test(tx) &&
        !tx.includes(wk)
      ) {
        break
      }
    }
    out('.vilhelm-paiva').append(p.clone())
  }
  return out('.vilhelm-paiva').html() ?? null
}

async function menuVilhelm(scope: MenuScope): Promise<MenuResult> {
  const url = restaurants.find((r) => r.id === 'vilhelm')!.embedUrl
  const raw = await fetchHtml(url)
  const $ = load(raw)
  const row = $('#lounaslista').closest('.dmRespRow')
  if (!row.length) return { kind: 'error', message: 'Lounaslistaa ei löytynyt.' }
  const next = row.next('.dmRespRow').first()
  const inner$ = load('<div class="vilhelm-lounas"></div>')
  const box = inner$('.vilhelm-lounas')
  box.append(row.clone())
  if (next.length) box.append(next.clone())
  let inner = inner$('.vilhelm-lounas').html() ?? ''
  if (scope === 'today') {
    const dayOnly = sliceVilhelmDay(inner)
    if (dayOnly) inner = dayOnly
  }
  inner = sanitizeHtmlString(inner)
  return { kind: 'html', html: wrapHtmlFragment(scope === 'today' ? 'Tänään' : 'Lounaslista', inner) }
}

async function menuLeivos(scope: MenuScope): Promise<MenuResult> {
  const url = restaurants.find((r) => r.id === 'leivos')!.embedUrl
  const raw = await fetchHtml(url)
  const $ = load(raw)
  const section = $('section.lounasbox').first()
  if (!section.length) return { kind: 'error', message: 'Lounaslistaa ei löytynyt.' }

  if (scope === 'today') {
    const wk = getFiWeekdayLong().toLowerCase()
    let dayHtml: string | null = null
    section.find('h2.text-capitalize').each((_, el) => {
      if ($(el).text().trim().toLowerCase() === wk) {
        const ul = $(el).closest('ul')
        dayHtml = ul.length ? $.html(ul) : null
        return false
      }
    })
    if (!dayHtml) {
      return { kind: 'error', message: 'Tämän päivän listaa ei löytynyt.' }
    }
    const inner = sanitizeHtmlString(dayHtml)
    return { kind: 'html', html: wrapHtmlFragment('Tänään', inner) }
  }

  const intro = $('#main .site-main .row.bg-light').first()
  const inner$ = load('<div class="leivos-lounas"></div>')
  const box = inner$('.leivos-lounas')
  if (intro.length) box.append(intro.clone())
  box.append(section.clone())
  const inner = sanitizeHtmlString(box.html() ?? '')
  return { kind: 'html', html: wrapHtmlFragment('Koko viikko', inner) }
}

function extractTourulaDaySectionFromRaw(raw: string): string | null {
  const $ = load(raw)
  $('[class*="elementor-hidden-"]').remove()
  const iframe = $('.entry-content iframe[src*="docs.google.com/presentation"]').first()
  if (!iframe.length) return null
  const sec = iframe.closest('section.elementor-top-section')
  const prev = sec.prev('section.elementor-top-section')
  const w = load('<div class="tourula-paiva"></div>')
  if (prev.length) w('.tourula-paiva').append(prev.clone())
  w('.tourula-paiva').append(sec.clone())
  $('.entry-content p').each((_, el) => {
    if ($(el).text().includes('Mobiilissa käännä')) {
      w('.tourula-paiva').append($(el).clone())
      return false
    }
  })
  return w('.tourula-paiva').html() ?? null
}

function extractTourulaWeekHtmlFromRaw(raw: string): string | null {
  const $ = load(raw)
  $('[class*="elementor-hidden-"]').remove()
  const ec = $('.entry-content').first()
  if (!ec.length) return null
  const w = load('<div class="tourula-viikko"></div>')
  w('.tourula-viikko').append(ec.clone())
  return w('.tourula-viikko').html() ?? null
}

/** Upotuksen osoitteesta julkaistun esityksen /pub-sivu (og:description sisältää ruokalistan tekstin). */
function toGoogleSlidesPubUrl(embedSrc: string): string | null {
  try {
    const u = new URL(embedSrc)
    if (!u.hostname.includes('docs.google.com')) return null
    let path = u.pathname
    if (path.endsWith('/pubembed')) {
      path = `${path.slice(0, -'/pubembed'.length)}/pub`
    } else if (path.endsWith('/embed')) {
      path = `${path.slice(0, -'/embed'.length)}/pub`
    } else if (!path.endsWith('/pub')) {
      return null
    }
    u.pathname = path
    u.search = ''
    return u.href
  } catch {
    return null
  }
}

function extractTourulaSlidesEmbedSrc(html: string): string | null {
  const $ = load(html)
  $('[class*="elementor-hidden-"]').remove()
  const iframe = $('.entry-content iframe[src*="docs.google.com/presentation"]').first()
  const src = iframe.attr('src')?.trim()
  return src || null
}

/**
 * og:description on yksi teksti; erottelee annokset (ei sanoilla " L " yksinään).
 * Esim. "Wieninleike L Paistetut perunat L,G ..." → useita rivejä.
 */
function splitTourulaOgMenuDescription(desc: string): string[] {
  const t = desc.trim()
  if (!t) return []
  return t
    .split(/\s+(?=[A-ZÄÖÅ][a-zäöå]+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

async function tryTourulaMenuLinesFromSlidesOg(raw: string): Promise<string[] | null> {
  const embedSrc = extractTourulaSlidesEmbedSrc(raw)
  if (!embedSrc) return null
  const pubUrl = toGoogleSlidesPubUrl(embedSrc)
  if (!pubUrl) return null
  try {
    const res = await fetch(pubUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fi-FI,fi;q=0.9',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const page = await res.text()
    const $ = load(page)
    const desc = $('meta[property="og:description"]').attr('content')?.trim()
    if (!desc) return null
    const lines = splitTourulaOgMenuDescription(desc)
    return lines.length > 0 ? lines : null
  } catch {
    return null
  }
}

async function menuTourula(scope: MenuScope): Promise<MenuResult> {
  const url = restaurants.find((r) => r.id === 'tourula')!.embedUrl
  const raw = await fetchHtml(url)

  if (scope === 'today') {
    const ogLines = await tryTourulaMenuLinesFromSlidesOg(raw)
    if (ogLines) {
      const inner = ogLines
        .map((line) => `<p class="menu-pdf-line">${escapeHtml(line)}</p>`)
        .join('')
      const note = `<p class="menu-extract__note">Koko viikon näkymä: napauta ravintolan otsikkoa.</p>`
      return { kind: 'html', html: wrapHtmlFragment('Tänään', inner + note) }
    }

    const inner = extractTourulaDaySectionFromRaw(raw)
    if (!inner) return { kind: 'error', message: 'Päivän upotusta ei löytynyt.' }
    const sanitized = sanitizeHtmlString(inner)
    const note = `<p class="menu-extract__note">Koko viikon näkymä: napauta ravintolan otsikkoa.</p>`
    return { kind: 'html', html: wrapHtmlFragment('Päivän lista (buffet)', sanitized + note) }
  }

  const inner = extractTourulaWeekHtmlFromRaw(raw)
  if (!inner) return { kind: 'error', message: 'Sisältöä ei löytynyt.' }
  const sanitized = sanitizeHtmlString(inner)
  const note = `<p class="menu-extract__note">Lisätieto: <a href="http://www.lounasinfo.fi/index.php?c=Suomi&amp;t=Jyv%C3%A4skyl%C3%A4&amp;a=Tourula&amp;r=12" target="_blank" rel="noopener">lounasinfo.fi</a></p>`
  return { kind: 'html', html: wrapHtmlFragment('Koko viikko', sanitized + note) }
}

async function menuPapas(scope: MenuScope): Promise<MenuResult> {
  const url = restaurants.find((r) => r.id === 'papas')!.embedUrl
  const raw = await fetchHtml(url)
  const pdf = extractPapasLounasPdfUrl(raw)
  if (!pdf) return { kind: 'error', message: 'PDF-linkkiä ei löytynyt.' }
  const proxy = `/api/pdf-proxy?u=${encodeURIComponent(pdf)}`

  if (scope === 'today') {
    const fromPdf = await tryPdfTodayAsHtml(pdf)
    if (fromPdf) {
      const note = `<p class="menu-extract__note">Koko viikon PDF: <a href="${proxy}" target="_blank" rel="noopener">avaa</a> tai napauta ravintolan otsikkoa.</p>`
      return {
        kind: 'html',
        html: wrapHtmlFragment('Tänään', fromPdf + note),
      }
    }
    return {
      kind: 'pdf',
      pdfUrl: proxy,
      variant: 'compact',
    }
  }

  return {
    kind: 'pdf',
    pdfUrl: proxy,
    variant: 'full',
  }
}

async function menuSeppala(scope: MenuScope): Promise<MenuResult> {
  const base = 'https://www.seppalanlounaskeskus.fi'
  const url = restaurants.find((r) => r.id === 'seppala')!.embedUrl
  const raw = await fetchHtml(url)
  const $ = load(raw)
  let href = $('#menulink3').attr('href')
  if (!href) {
    href = $('a[href*="lounari_lounaslistat"][href$=".pdf"]').first().attr('href')
  }
  if (!href) return { kind: 'error', message: 'PDF-linkkiä ei löytynyt.' }
  const pdf = new URL(href, base).href
  const proxy = `/api/pdf-proxy?u=${encodeURIComponent(pdf)}`

  if (scope === 'today') {
    const fromPdf = await tryPdfTodayAsHtml(pdf)
    if (fromPdf) {
      const note = `<p class="menu-extract__note">Koko viikon PDF: <a href="${proxy}" target="_blank" rel="noopener">avaa</a> tai napauta ravintolan otsikkoa.</p>`
      return {
        kind: 'html',
        html: wrapHtmlFragment('Tänään', fromPdf + note),
      }
    }
    return {
      kind: 'pdf',
      pdfUrl: proxy,
      variant: 'compact',
    }
  }

  return {
    kind: 'pdf',
    pdfUrl: proxy,
    variant: 'full',
  }
}

export async function getMenuForRestaurant(
  id: string,
  scope: MenuScope = 'week',
): Promise<MenuResult> {
  try {
    switch (id) {
      case 'vilhelm':
        return await menuVilhelm(scope)
      case 'leivos':
        return await menuLeivos(scope)
      case 'tourula':
        return await menuTourula(scope)
      case 'papas':
        return await menuPapas(scope)
      case 'seppala':
        return await menuSeppala(scope)
      default:
        return { kind: 'error', message: 'Tuntematon ravintola.' }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Virhe'
    return { kind: 'error', message: msg }
  }
}

export async function getAllMenus(scope: MenuScope): Promise<Record<string, MenuResult>> {
  const ids = restaurants.map((r) => r.id)
  const entries = await Promise.all(
    ids.map(async (id) => [id, await getMenuForRestaurant(id, scope)] as const),
  )
  return Object.fromEntries(entries)
}

export function isPdfProxyAllowed(target: URL): boolean {
  const host = target.hostname.replace(/^www\./, '').toLowerCase()
  if (host === 'ravintola-papas.fi') return target.pathname.toLowerCase().endsWith('.pdf')
  if (host === 'seppalanlounaskeskus.fi')
    return target.pathname.toLowerCase().endsWith('.pdf')
  if (host === 'asiakas.kotisivukone.com')
    return target.pathname.toLowerCase().includes('seppalan') && target.pathname.toLowerCase().endsWith('.pdf')
  return false
}
