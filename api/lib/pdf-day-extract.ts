import { getFiWeekdayLong } from '../../src/date-fns-fi.ts'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const WEEKDAYS = [
  'maanantai',
  'tiistai',
  'keskiviikko',
  'torstai',
  'perjantai',
  'lauantai',
  'sunnuntai',
] as const

type WeekdayLong = (typeof WEEKDAYS)[number]

/** PDF:t käyttävät usein lyhenteitä rivin alussa: Ma 6.4., Ti. 7.4, Ke 8.4. */
const ABBREV_PREFIX = /^(Ma|Ti|Ke|To|Pe|La|Su)(\.|\s|$)/i

const ABBREV_TO_LONG: Record<string, WeekdayLong> = {
  ma: 'maanantai',
  ti: 'tiistai',
  ke: 'keskiviikko',
  to: 'torstai',
  pe: 'perjantai',
  la: 'lauantai',
  su: 'sunnuntai',
}

/** Viikonpäivän lyhenne rivin alussa (Ma / Ti. …), ei esim. "Makkarakeitto"-sanasta. */
function weekdayAbbrevAtLineStart(line: string): WeekdayLong | null {
  const t = line.trim()
  const m = t.match(ABBREV_PREFIX)
  if (!m) return null
  const key = m[1].slice(0, 2).toLowerCase()
  return ABBREV_TO_LONG[key] ?? null
}

/** Ensimmäinen viikonpäivän nimi rivillä; pidemmät ensin (esim. keskiviikko ennen tiistai). */
function weekdayInLine(line: string): WeekdayLong | null {
  const l = line.toLowerCase()
  const ordered = [...WEEKDAYS].sort((a, b) => b.length - a.length)
  for (const d of ordered) {
    if (l.includes(d)) return d
  }
  return null
}

/**
 * Mikä viikonpäivä rivi "julistaa" (otsikko). Lyhenne rivin alussa voittaa,
 * sitten pitkät nimet — jotta "ma-pe" tai "Makkarakeitto" ei tulkitse päiväksi.
 */
function primaryWeekdayOnLine(line: string): WeekdayLong | null {
  const abbrev = weekdayAbbrevAtLineStart(line)
  if (abbrev) return abbrev
  return weekdayInLine(line)
}

/**
 * Leikkaa viikkotekstistä tämän päivän osuuden: alkaa riviltä jossa on tämän viikonpäivän nimi,
 * päättyy kun tulee toisen päivän otsikkorivi.
 */
export function sliceTodayFromWeeklyPlainText(fullText: string): string | null {
  const target = getFiWeekdayLong().toLowerCase() as WeekdayLong
  const rawLines = fullText.split(/\r?\n/)
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0)

  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const w = primaryWeekdayOnLine(lines[i])
    if (w === target) {
      start = i
      break
    }
  }

  if (start === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(target)) {
        start = i
        break
      }
    }
  }

  if (start === -1) return null

  const out: string[] = [lines[start]]
  for (let i = start + 1; i < lines.length; i++) {
    const w = primaryWeekdayOnLine(lines[i])
    if (w !== null && w !== target) break
    out.push(lines[i])
  }

  return out.join('\n').trim() || null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function plainLunchBlockToHtml(block: string): string {
  const lines = block.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')
}

export async function extractTextFromPdfBuffer(data: Buffer): Promise<string> {
  /** Dynaaminen import: välttää pdfjs-distin latauksen serverless-kylmäkäynnissä (Vercel). */
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(data) })
  try {
    const result = await parser.getText()
    return result.text ?? ''
  } finally {
    await parser.destroy()
  }
}

export async function fetchPdfBuffer(url: string, referer?: string): Promise<Buffer> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fi-FI,fi;q=0.9,en-US;q=0.7,en;q=0.6',
  }
  if (referer) {
    headers.Referer = referer
    try {
      headers.Origin = new URL(referer).origin
    } catch {
      /* noop */
    }
  }
  const res = await fetch(url, {
    headers,
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`PDF ${res.status}`)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('pdf') && !ct.includes('octet-stream')) {
    /* jotkut palvelimet lähettävät väärän tyypin */
  }
  return Buffer.from(await res.arrayBuffer())
}

/** Poistaa tyhjät rivit ja tyypilliset PDF-tulosteen roskarivit. */
export function cleanWeeklyPdfPlainText(fullText: string): string | null {
  const rawLines = fullText.split(/\r?\n/)
  const lines = rawLines
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length === 0) return false
      if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l)) return false
      if (/^sivu\s+\d+/i.test(l)) return false
      return true
    })
  return lines.join('\n').trim() || null
}

/** Koko PDF:n teksti kappaleiksi (viikkonäkymä). */
export async function tryPdfFullWeekAsHtml(pdfUrl: string): Promise<string | null> {
  const { fullWeekHtml } = await tryPdfMenusFromUrl(pdfUrl)
  return fullWeekHtml
}

/** Yrittää palauttaa tämän päivän HTML:n PDF:stä; null jos ei onnistu. */
export async function tryPdfTodayAsHtml(pdfUrl: string): Promise<string | null> {
  const { todayHtml } = await tryPdfMenusFromUrl(pdfUrl)
  return todayHtml
}

export type PdfMenusHtml = { fullWeekHtml: string | null; todayHtml: string | null }

/** Yksi PDF-haku: sekä koko viikko että tämän päivän HTML (jos erottuu). */
export async function tryPdfMenusFromUrl(
  pdfUrl: string,
  referer?: string,
): Promise<PdfMenusHtml> {
  try {
    const buf = await fetchPdfBuffer(pdfUrl, referer)
    const text = await extractTextFromPdfBuffer(buf)
    const trimmed = text?.trim() ?? ''
    if (trimmed.length < 8) {
      return { fullWeekHtml: null, todayHtml: null }
    }
    const cleaned = cleanWeeklyPdfPlainText(text)
    let fullWeekHtml = cleaned ? plainLunchBlockToHtml(cleaned) : null
    if (!fullWeekHtml && trimmed.length >= 15) {
      const rough = trimmed
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .slice(0, 80)
        .join('\n')
      if (rough.length > 10) fullWeekHtml = plainLunchBlockToHtml(rough)
    }
    const slice = sliceTodayFromWeeklyPlainText(text)
    let todayHtml = slice ? plainLunchBlockToHtml(slice) : null
    if (!todayHtml && fullWeekHtml) {
      const loose = sliceTodayLoose(trimmed)
      if (loose) todayHtml = plainLunchBlockToHtml(loose)
    }
    return { fullWeekHtml, todayHtml }
  } catch {
    return { fullWeekHtml: null, todayHtml: null }
  }
}

/** Jos PDF:ssä on vain lyhenne (To 9.4.) eikä päivän nimeä, ota ensimmäiset ruokarivit. */
function sliceTodayLoose(text: string): string | null {
  const target = getFiWeekdayLong().toLowerCase()
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  const abbrev =
    /^(ma|ti|ke|to|pe|la|su)\b/i
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase()
    if (l.includes(target)) {
      start = i
      break
    }
    if (abbrev.test(lines[i]) && (lines[i].includes('.') || /\d/.test(lines[i]))) {
      start = i
      break
    }
  }
  if (start === -1) return null
  const out: string[] = [lines[start]]
  for (let i = start + 1; i < lines.length && i < start + 25; i++) {
    const l = lines[i]
    if (abbrev.test(l) && i > start) break
    out.push(l)
  }
  return out.join('\n').trim() || null
}
