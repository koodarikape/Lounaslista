import './style.css'
import { restaurants } from './data/restaurants.ts'

type MenuApiOk = { kind: 'html'; html: string }
type MenuApiErr = { kind: 'error'; message: string }
type MenuApiResponse = MenuApiOk | MenuApiErr

type BatchResponse = { scope: string; items: Record<string, MenuApiResponse> }

const HELSINKI_TZ = 'Europe/Helsinki'

/** Kalenteripäivä Helsinki-ajassa (YYYY-MM-DD), keskiyön tunnistusta varten. */
function helsinkiDateKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HELSINKI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

/** Millisekuntit seuraavaan Helsinki-keskiyöhön (`fromMs`-hetkestä). */
function msUntilNextHelsinkiMidnight(fromMs: number): number {
  const startKey = helsinkiDateKey(fromMs)
  let lo = fromMs
  let hi = fromMs + 27 * 3600 * 1000
  while (helsinkiDateKey(hi) === startKey) {
    hi += 24 * 3600 * 1000
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (helsinkiDateKey(mid) === startKey) lo = mid
    else hi = mid
  }
  return hi - fromMs
}

let lastHelsinkiDateKey = helsinkiDateKey(Date.now())
let midnightTimer: ReturnType<typeof setTimeout> | null = null

function refreshTodayAfterDateChange() {
  const meta = document.querySelector('.brand__meta')
  if (meta) meta.textContent = formatDateFi(new Date())
  if (view === 'feed') void loadFeedMenus()
}

function scheduleMidnightRefresh() {
  if (midnightTimer !== null) {
    clearTimeout(midnightTimer)
    midnightTimer = null
  }
  const ms = msUntilNextHelsinkiMidnight(Date.now())
  midnightTimer = setTimeout(() => {
    midnightTimer = null
    lastHelsinkiDateKey = helsinkiDateKey(Date.now())
    refreshTodayAfterDateChange()
    scheduleMidnightRefresh()
  }, ms)
}

function checkHelsinkiDayChanged() {
  const key = helsinkiDateKey(Date.now())
  if (key === lastHelsinkiDateKey) return
  lastHelsinkiDateKey = key
  refreshTodayAfterDateChange()
  scheduleMidnightRefresh()
}

function formatDateFi(d: Date): string {
  return d.toLocaleDateString('fi-FI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: HELSINKI_TZ,
  })
}

const app = document.querySelector<HTMLDivElement>('#app')!

let view: 'feed' | 'detail' = 'feed'
let detailId: string | null = null

function renderMenuResult(data: MenuApiResponse): string {
  if (data.kind === 'html') return data.html
  return `<p class="menu-error">${escapeHtml(data.message)}</p>`
}

function render() {
  if (view === 'detail' && detailId) {
    renderDetail(detailId)
    return
  }
  renderFeed()
}

function renderFeed() {
  lastHelsinkiDateKey = helsinkiDateKey(Date.now())
  app.innerHTML = `
    <header class="site-header site-header--compact">
      <div class="site-header__inner">
        <h1 class="brand__title">Lounaslista</h1>
        <p class="brand__meta">${formatDateFi(new Date())}</p>
      </div>
    </header>

    <main class="feed" id="feed-main" aria-label="Tämän päivän lounaslistat">
      ${restaurants
        .map(
          (r) => `
        <article
          class="feed-card feed-card--nav"
          data-restaurant="${escapeHtml(r.id)}"
          tabindex="0"
          role="link"
          aria-label="${escapeHtml(r.name)}: avaa koko viikon ruokalista"
        >
          <div class="feed-card__header">
            <span class="feed-card__title">${escapeHtml(r.name)}</span>
            <span class="feed-card__area">${escapeHtml(r.area)}</span>
            <span class="feed-card__chevron" aria-hidden="true">›</span>
          </div>
          <div class="feed-card__body" id="feed-body-${escapeHtml(r.id)}">
            <p class="menu-loading">…</p>
          </div>
        </article>
      `,
        )
        .join('')}
    </main>

    <footer class="site-footer">
      <p>Listat tulevat ravintoloiden omilta sivuilta. Tarkista hinnat ja allergiat paikan päällä.</p>
    </footer>
  `

  app.querySelectorAll<HTMLElement>('.feed-card--nav').forEach((card) => {
    const openDetail = () => {
      const id = card.dataset.restaurant
      if (!id) return
      detailId = id
      view = 'detail'
      render()
    }
    card.addEventListener('click', (e) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('a')) return
      openDetail()
    })
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openDetail()
      }
    })
  })

  void loadFeedMenus()
}

async function loadFeedMenus() {
  try {
    const r = await fetch('/api/menus?scope=today')
    const batch = (await r.json()) as BatchResponse
    for (const rest of restaurants) {
      const el = document.getElementById(`feed-body-${rest.id}`)
      if (!el) continue
      const data = batch.items[rest.id]
      if (!data) {
        el.innerHTML = '<p class="menu-error">Ei vastausta.</p>'
        continue
      }
      el.innerHTML = renderMenuResult(data)
    }
  } catch {
    for (const rest of restaurants) {
      const el = document.getElementById(`feed-body-${rest.id}`)
      if (el) {
        el.innerHTML =
          '<p class="menu-error">Lataus epäonnistui. Päivitä sivu.</p>'
      }
    }
  }
}

function renderDetail(id: string) {
  const r = restaurants.find((x) => x.id === id)
  if (!r) {
    view = 'feed'
    detailId = null
    renderFeed()
    return
  }

  app.innerHTML = `
    <header class="detail-header">
      <button type="button" class="btn-back" id="btn-back" aria-label="Takaisin">
        ← Kaikki listat
      </button>
      <div class="detail-header__text">
        <h1 class="detail-title">${escapeHtml(r.name)}</h1>
        <p class="detail-area">${escapeHtml(r.area)}</p>
      </div>
    </header>

    <div class="menu-panel-wrap menu-panel-wrap--detail">
      <div class="menu-panel" id="detail-menu" role="region" aria-label="Viikon ruokalista">
        <p class="menu-loading">Ladataan…</p>
      </div>
    </div>
  `

  document.getElementById('btn-back')?.addEventListener('click', () => {
    view = 'feed'
    detailId = null
    render()
  })

  void loadDetailMenu(id)
}

async function loadDetailMenu(restaurantId: string) {
  const el = document.getElementById('detail-menu')
  if (!el) return
  try {
    const r = await fetch(
      '/api/menu?id=' +
        encodeURIComponent(restaurantId) +
        '&scope=week',
    )
    const data = (await r.json()) as MenuApiResponse
    el.innerHTML = renderMenuResult(data)
  } catch {
    el.innerHTML =
      '<p class="menu-error">Lataus epäonnistui.</p>'
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

scheduleMidnightRefresh()

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkHelsinkiDayChanged()
})

render()
