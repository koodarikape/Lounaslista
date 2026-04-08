import './style.css'
import { restaurants } from './data/restaurants.ts'

type MenuApiOk = { kind: 'html'; html: string } | { kind: 'pdf'; pdfUrl: string; variant?: 'compact' | 'full' }
type MenuApiErr = { kind: 'error'; message: string }
type MenuApiResponse = MenuApiOk | MenuApiErr

type BatchResponse = { scope: string; items: Record<string, MenuApiResponse> }

function formatDateFi(d: Date): string {
  return d.toLocaleDateString('fi-FI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Helsinki',
  })
}

const app = document.querySelector<HTMLDivElement>('#app')!

let view: 'feed' | 'detail' = 'feed'
let detailId: string | null = null

function renderMenuResult(data: MenuApiResponse): string {
  if (data.kind === 'html') return data.html
  if (data.kind === 'pdf') {
    const cls =
      data.variant === 'compact' ? 'menu-pdf-frame menu-pdf-frame--compact' : 'menu-pdf-frame'
    return `<iframe class="${cls}" title="Lounaslista PDF" src="${escapeHtml(data.pdfUrl)}"></iframe>`
  }
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
  app.innerHTML = `
    <header class="site-header site-header--compact">
      <div class="site-header__inner">
        <h1 class="brand__title">Lounaslista</h1>
        <p class="brand__meta">${formatDateFi(new Date())}</p>
        <p class="intro intro--short">Kaikkien valittujen ravintoloiden tämän päivän listat. Napauta korttia avataksesi koko viikon ruokalistan.</p>
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
      <a class="btn btn--ghost" href="${escapeHtml(r.embedUrl)}" target="_blank" rel="noopener noreferrer">Alkuperäinen sivu</a>
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

render()
