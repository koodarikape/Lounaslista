var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/date-fns-fi.ts
function getFiWeekdayLong(d = /* @__PURE__ */ new Date()) {
  return d.toLocaleDateString("fi-FI", {
    weekday: "long",
    timeZone: "Europe/Helsinki"
  });
}
function getFiDatePatterns(d = /* @__PURE__ */ new Date()) {
  const helsinki = new Date(
    d.toLocaleString("en-US", { timeZone: "Europe/Helsinki" })
  );
  const day = helsinki.getDate();
  const month = helsinki.getMonth() + 1;
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return [
    `${dd}.${mm}.`,
    `${day}.${month}.`,
    `${dd}.${month}.`,
    `${day}.${mm}.`
  ];
}
var init_date_fns_fi = __esm({
  "src/date-fns-fi.ts"() {
  }
});

// api/lib/pdf-day-extract.ts
function weekdayAbbrevAtLineStart(line) {
  const t = line.trim();
  const m = t.match(ABBREV_PREFIX);
  if (!m) return null;
  const key = m[1].slice(0, 2).toLowerCase();
  return ABBREV_TO_LONG[key] ?? null;
}
function weekdayInLine(line) {
  const l = line.toLowerCase();
  const ordered = [...WEEKDAYS].sort((a, b) => b.length - a.length);
  for (const d of ordered) {
    if (l.includes(d)) return d;
  }
  return null;
}
function primaryWeekdayOnLine(line) {
  const abbrev = weekdayAbbrevAtLineStart(line);
  if (abbrev) return abbrev;
  return weekdayInLine(line);
}
function sliceTodayFromWeeklyPlainText(fullText) {
  const target = getFiWeekdayLong().toLowerCase();
  const rawLines = fullText.split(/\r?\n/);
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const w = primaryWeekdayOnLine(lines[i]);
    if (w === target) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(target)) {
        start = i;
        break;
      }
    }
  }
  if (start === -1) return null;
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    const w = primaryWeekdayOnLine(lines[i]);
    if (w !== null && w !== target) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim() || null;
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function plainLunchBlockToHtml(block) {
  const lines = block.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
}
async function extractTextFromPdfBuffer(data) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}
async function fetchPdfBuffer(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/pdf,*/*"
    },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`PDF ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("pdf") && !ct.includes("octet-stream")) {
  }
  return Buffer.from(await res.arrayBuffer());
}
function cleanWeeklyPdfPlainText(fullText) {
  const rawLines = fullText.split(/\r?\n/);
  const lines = rawLines.map((l) => l.trim()).filter((l) => {
    if (l.length === 0) return false;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l)) return false;
    if (/^sivu\s+\d+/i.test(l)) return false;
    return true;
  });
  return lines.join("\n").trim() || null;
}
async function tryPdfMenusFromUrl(pdfUrl) {
  try {
    const buf = await fetchPdfBuffer(pdfUrl);
    const text = await extractTextFromPdfBuffer(buf);
    if (!text || text.trim().length < 20) {
      return { fullWeekHtml: null, todayHtml: null };
    }
    const cleaned = cleanWeeklyPdfPlainText(text);
    const fullWeekHtml = cleaned ? plainLunchBlockToHtml(cleaned) : null;
    const slice = sliceTodayFromWeeklyPlainText(text);
    const todayHtml = slice ? plainLunchBlockToHtml(slice) : null;
    return { fullWeekHtml, todayHtml };
  } catch {
    return { fullWeekHtml: null, todayHtml: null };
  }
}
var UA, WEEKDAYS, ABBREV_PREFIX, ABBREV_TO_LONG;
var init_pdf_day_extract = __esm({
  "api/lib/pdf-day-extract.ts"() {
    init_date_fns_fi();
    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    WEEKDAYS = [
      "maanantai",
      "tiistai",
      "keskiviikko",
      "torstai",
      "perjantai",
      "lauantai",
      "sunnuntai"
    ];
    ABBREV_PREFIX = /^(Ma|Ti|Ke|To|Pe|La|Su)(\.|\s|$)/i;
    ABBREV_TO_LONG = {
      ma: "maanantai",
      ti: "tiistai",
      ke: "keskiviikko",
      to: "torstai",
      pe: "perjantai",
      la: "lauantai",
      su: "sunnuntai"
    };
  }
});

// src/data/restaurants.ts
var restaurants;
var init_restaurants = __esm({
  "src/data/restaurants.ts"() {
    restaurants = [
      {
        id: "vilhelm",
        name: "Cafe Vilhelm",
        area: "Ahjokatu 18, Sepp\xE4l\xE4",
        embedUrl: "https://www.cafevilhelm.fi/lounas"
      },
      {
        id: "papas",
        name: "Ravintola Papa's",
        area: "Laukaantie 4, Grafila (2. krs)",
        embedUrl: "https://www.ravintola-papas.fi/"
      },
      {
        id: "tourula",
        name: "Tourulan lounasravintola",
        area: "Vapaaherrantie 2, Tourula",
        embedUrl: "https://www.tourulanravintola.fi/buffet-lounas/"
      },
      {
        id: "leivos",
        name: "Lounas & Leivos Butik",
        area: "Sorastajantie 2, Sepp\xE4l\xE4nkangas",
        embedUrl: "https://leivosbutik.fi/lounas-jyvaskyla/"
      },
      {
        id: "seppala",
        name: "Sepp\xE4l\xE4n lounaskeskus",
        area: "Vasarakatu 29, Sepp\xE4l\xE4",
        embedUrl: "https://www.seppalanlounaskeskus.fi/"
      }
    ];
  }
});

// api/lib/menu-extract.ts
var menu_extract_exports = {};
__export(menu_extract_exports, {
  extractPapasLounasPdfUrl: () => extractPapasLounasPdfUrl,
  getAllMenus: () => getAllMenus,
  getMenuForRestaurant: () => getMenuForRestaurant
});
async function loadCheerio() {
  if (!cheerioLoadMemo) {
    const { load } = await import("cheerio/slim");
    cheerioLoadMemo = load;
  }
  return cheerioLoadMemo;
}
async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA2,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fi-FI,fi;q=0.9,en;q=0.7"
    },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html")) throw new Error("Ei HTML-vastausta");
  return res.text();
}
async function sanitizeHtmlString(html) {
  const load = await loadCheerio();
  const $ = load(`<div id="__root">${html}</div>`);
  const root = $("#__root");
  root.find("script, link").remove();
  root.find("iframe").each((_, el) => {
    const $f = $(el);
    const src = $f.attr("src")?.trim() ?? "";
    const ok = /^https:\/\/docs\.google\.com\//i.test(src) || /^https:\/\/drive\.google\.com\//i.test(src);
    if (!ok) {
      $f.remove();
      return;
    }
    $f.addClass("menu-embed-iframe");
    $f.attr("loading", "lazy");
    if (!$f.attr("title")) $f.attr("title", "Lounaslista");
  });
  root.find("*").each((_, el) => {
    $(el).removeAttr("onclick").removeAttr("onload").removeAttr("onerror");
  });
  return root.html() ?? "";
}
function extractPapasLounasPdfUrl(html) {
  const re = /href\s*=\s*["']?(https?:\/\/[^"'\s<>]+\.pdf)/gi;
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    found.push(m[1]);
  }
  const preferred = found.find((u) => /lounaslista/i.test(u));
  const chosen = preferred ?? found[0];
  if (!chosen) return null;
  try {
    const u = new URL(chosen);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "ravintola-papas.fi") return null;
    return chosen;
  } catch {
    return null;
  }
}
function wrapHtmlFragment(title, inner) {
  return `<div class="menu-extract" data-menu="1"><h3 class="menu-extract__title">${escapeHtml2(title)}</h3>${inner}</div>`;
}
function wrapTodayHtmlFragment(inner) {
  return wrapHtmlFragment("T\xE4n\xE4\xE4n", inner);
}
function escapeHtml2(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
async function sliceVilhelmDay(html) {
  const load = await loadCheerio();
  const wk = getFiWeekdayLong().toLowerCase();
  const patterns = getFiDatePatterns();
  const $ = load(`<div id="__slice">${html}</div>`);
  const paras = $("#__slice").find("p").toArray();
  let startIdx = -1;
  for (let i = 0; i < paras.length; i++) {
    const st = $(paras[i]).find("strong").first().text();
    const tl = st.toLowerCase();
    const dateHit = patterns.some((p) => st.includes(p) || st.includes(p.replace(/\.$/, "")));
    if (tl.includes(wk) || dateHit) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;
  const out = load('<div class="vilhelm-paiva"></div>');
  for (let i = startIdx; i < paras.length; i++) {
    const p = $(paras[i]);
    const fst = p.find("strong").first();
    if (i > startIdx && fst.length) {
      const tx = fst.text().toLowerCase();
      if (/maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai/.test(tx) && !tx.includes(wk)) {
        break;
      }
    }
    out(".vilhelm-paiva").append(p.clone());
  }
  return out(".vilhelm-paiva").html() ?? null;
}
async function menuVilhelm(scope) {
  const load = await loadCheerio();
  const url = restaurants.find((r) => r.id === "vilhelm").embedUrl;
  const raw = await fetchHtml(url);
  const $ = load(raw);
  const row = $("#lounaslista").closest(".dmRespRow");
  if (!row.length) return { kind: "error", message: "Lounaslistaa ei l\xF6ytynyt." };
  const next = row.next(".dmRespRow").first();
  const inner$ = load('<div class="vilhelm-lounas"></div>');
  const box = inner$(".vilhelm-lounas");
  box.append(row.clone());
  if (next.length) box.append(next.clone());
  let inner = inner$(".vilhelm-lounas").html() ?? "";
  if (scope === "today") {
    const dayOnly = await sliceVilhelmDay(inner);
    if (dayOnly) inner = dayOnly;
  }
  inner = await sanitizeHtmlString(inner);
  const html = scope === "today" ? wrapTodayHtmlFragment(inner) : wrapHtmlFragment("Lounaslista", inner);
  return { kind: "html", html };
}
async function menuLeivos(scope) {
  const load = await loadCheerio();
  const url = restaurants.find((r) => r.id === "leivos").embedUrl;
  const raw = await fetchHtml(url);
  const $ = load(raw);
  const section = $("section.lounasbox").first();
  if (!section.length) return { kind: "error", message: "Lounaslistaa ei l\xF6ytynyt." };
  if (scope === "today") {
    const wk = getFiWeekdayLong().toLowerCase();
    let dayHtml = null;
    section.find("h2.text-capitalize").each((_, el) => {
      if ($(el).text().trim().toLowerCase() === wk) {
        const ul = $(el).closest("ul");
        dayHtml = ul.length ? $.html(ul) : null;
        return false;
      }
    });
    if (!dayHtml) {
      return { kind: "error", message: "T\xE4m\xE4n p\xE4iv\xE4n listaa ei l\xF6ytynyt." };
    }
    const inner2 = await sanitizeHtmlString(dayHtml);
    return { kind: "html", html: wrapTodayHtmlFragment(inner2) };
  }
  const inner$ = load('<div class="leivos-lounas"></div>');
  const box = inner$(".leivos-lounas");
  box.append(section.clone());
  const inner = await sanitizeHtmlString(box.html() ?? "");
  return { kind: "html", html: wrapHtmlFragment("Lounaslista", inner) };
}
async function extractTourulaDaySectionFromRaw(raw) {
  const load = await loadCheerio();
  const $ = load(raw);
  $('[class*="elementor-hidden-"]').remove();
  const iframe = $('.entry-content iframe[src*="docs.google.com/presentation"]').first();
  if (!iframe.length) return null;
  const sec = iframe.closest("section.elementor-top-section");
  const prev = sec.prev("section.elementor-top-section");
  const w = load('<div class="tourula-paiva"></div>');
  if (prev.length) w(".tourula-paiva").append(prev.clone());
  w(".tourula-paiva").append(sec.clone());
  $(".entry-content p").each((_, el) => {
    if ($(el).text().includes("Mobiilissa k\xE4\xE4nn\xE4")) {
      w(".tourula-paiva").append($(el).clone());
      return false;
    }
  });
  return w(".tourula-paiva").html() ?? null;
}
async function extractTourulaWeekHtmlFromRaw(raw) {
  const load = await loadCheerio();
  const $ = load(raw);
  $('[class*="elementor-hidden-"]').remove();
  const ec = $(".entry-content").first();
  if (!ec.length) return null;
  const w = load('<div class="tourula-viikko"></div>');
  w(".tourula-viikko").append(ec.clone());
  return w(".tourula-viikko").html() ?? null;
}
function toGoogleSlidesPubUrl(embedSrc) {
  try {
    const u = new URL(embedSrc);
    if (!u.hostname.includes("docs.google.com")) return null;
    let path = u.pathname;
    if (path.endsWith("/pubembed")) {
      path = `${path.slice(0, -"/pubembed".length)}/pub`;
    } else if (path.endsWith("/embed")) {
      path = `${path.slice(0, -"/embed".length)}/pub`;
    } else if (!path.endsWith("/pub")) {
      return null;
    }
    u.pathname = path;
    u.search = "";
    return u.href;
  } catch {
    return null;
  }
}
async function extractTourulaSlidesEmbedSrc(html) {
  const load = await loadCheerio();
  const $ = load(html);
  $('[class*="elementor-hidden-"]').remove();
  const iframe = $('.entry-content iframe[src*="docs.google.com/presentation"]').first();
  const src = iframe.attr("src")?.trim();
  return src || null;
}
function splitTourulaOgMenuDescription(desc) {
  const t = desc.trim();
  if (!t) return [];
  return t.split(/\s+(?=[A-ZÄÖÅ][a-zäöå]+)/).map((s) => s.trim()).filter((s) => s.length > 0);
}
async function tryTourulaMenuLinesFromSlidesOg(raw) {
  const embedSrc = await extractTourulaSlidesEmbedSrc(raw);
  if (!embedSrc) return null;
  const pubUrl = toGoogleSlidesPubUrl(embedSrc);
  if (!pubUrl) return null;
  try {
    const res = await fetch(pubUrl, {
      headers: {
        "User-Agent": UA2,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fi-FI,fi;q=0.9"
      },
      redirect: "follow"
    });
    if (!res.ok) return null;
    const page = await res.text();
    const load = await loadCheerio();
    const $ = load(page);
    const desc = $('meta[property="og:description"]').attr("content")?.trim();
    if (!desc) return null;
    const lines = splitTourulaOgMenuDescription(desc);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}
async function menuTourula(scope) {
  const url = restaurants.find((r) => r.id === "tourula").embedUrl;
  const raw = await fetchHtml(url);
  const ogLines = await tryTourulaMenuLinesFromSlidesOg(raw);
  const ogHtml = ogLines && ogLines.length > 0 ? ogLines.map((line) => `<p>${escapeHtml2(line)}</p>`).join("") : null;
  if (scope === "today") {
    if (ogHtml) {
      return { kind: "html", html: wrapTodayHtmlFragment(ogHtml) };
    }
    const inner2 = await extractTourulaDaySectionFromRaw(raw);
    if (!inner2) return { kind: "error", message: "P\xE4iv\xE4n upotusta ei l\xF6ytynyt." };
    const sanitized2 = await sanitizeHtmlString(inner2);
    return { kind: "html", html: wrapTodayHtmlFragment(sanitized2) };
  }
  if (ogHtml) {
    const note2 = `<p class="menu-extract__note">Lis\xE4tieto: <a href="http://www.lounasinfo.fi/index.php?c=Suomi&amp;t=Jyv%C3%A4skyl%C3%A4&amp;a=Tourula&amp;r=12" target="_blank" rel="noopener">lounasinfo.fi</a></p>`;
    return { kind: "html", html: wrapHtmlFragment("Lounaslista", ogHtml + note2) };
  }
  const inner = await extractTourulaWeekHtmlFromRaw(raw);
  if (!inner) return { kind: "error", message: "Sis\xE4lt\xF6\xE4 ei l\xF6ytynyt." };
  const sanitized = await sanitizeHtmlString(inner);
  const note = `<p class="menu-extract__note">Lis\xE4tieto: <a href="http://www.lounasinfo.fi/index.php?c=Suomi&amp;t=Jyv%C3%A4skyl%C3%A4&amp;a=Tourula&amp;r=12" target="_blank" rel="noopener">lounasinfo.fi</a></p>`;
  return { kind: "html", html: wrapHtmlFragment("Lounaslista", sanitized + note) };
}
async function menuPapas(scope) {
  const url = restaurants.find((r) => r.id === "papas").embedUrl;
  const raw = await fetchHtml(url);
  const pdf = extractPapasLounasPdfUrl(raw);
  if (!pdf) return { kind: "error", message: "Lounaslistan osoitetta ei l\xF6ytynyt." };
  const { fullWeekHtml: weekHtml, todayHtml } = await tryPdfMenusFromUrl(pdf);
  if (scope === "week") {
    if (weekHtml) {
      return { kind: "html", html: wrapHtmlFragment("Lounaslista", weekHtml) };
    }
    return {
      kind: "error",
      message: "Lounaslistan teksti\xE4 ei voitu lukea."
    };
  }
  if (todayHtml) {
    return { kind: "html", html: wrapTodayHtmlFragment(todayHtml) };
  }
  if (weekHtml) {
    const note = `<p class="menu-extract__note">P\xE4iv\xE4\xE4 ei erotettu; n\xE4ytet\xE4\xE4n koko viikko. Koko lista: napauta otsikkoa.</p>`;
    return { kind: "html", html: wrapTodayHtmlFragment(weekHtml + note) };
  }
  return { kind: "error", message: "Lounaslistan teksti\xE4 ei voitu lukea." };
}
async function menuSeppala(scope) {
  const load = await loadCheerio();
  const base = "https://www.seppalanlounaskeskus.fi";
  const url = restaurants.find((r) => r.id === "seppala").embedUrl;
  const raw = await fetchHtml(url);
  const $ = load(raw);
  let href = $("#menulink3").attr("href");
  if (!href) {
    href = $('a[href*="lounari_lounaslistat"][href$=".pdf"]').first().attr("href");
  }
  if (!href) return { kind: "error", message: "Lounaslistan osoitetta ei l\xF6ytynyt." };
  const pdf = new URL(href, base).href;
  const { fullWeekHtml: weekHtml, todayHtml } = await tryPdfMenusFromUrl(pdf);
  if (scope === "week") {
    if (weekHtml) {
      return { kind: "html", html: wrapHtmlFragment("Lounaslista", weekHtml) };
    }
    return {
      kind: "error",
      message: "Lounaslistan teksti\xE4 ei voitu lukea."
    };
  }
  if (todayHtml) {
    return { kind: "html", html: wrapTodayHtmlFragment(todayHtml) };
  }
  if (weekHtml) {
    const note = `<p class="menu-extract__note">P\xE4iv\xE4\xE4 ei erotettu; n\xE4ytet\xE4\xE4n koko viikko. Koko lista: napauta otsikkoa.</p>`;
    return { kind: "html", html: wrapTodayHtmlFragment(weekHtml + note) };
  }
  return { kind: "error", message: "Lounaslistan teksti\xE4 ei voitu lukea." };
}
async function getMenuForRestaurant(id, scope = "week") {
  try {
    switch (id) {
      case "vilhelm":
        return await menuVilhelm(scope);
      case "leivos":
        return await menuLeivos(scope);
      case "tourula":
        return await menuTourula(scope);
      case "papas":
        return await menuPapas(scope);
      case "seppala":
        return await menuSeppala(scope);
      default:
        return { kind: "error", message: "Tuntematon ravintola." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Virhe";
    return { kind: "error", message: msg };
  }
}
async function getAllMenus(scope) {
  const ids = restaurants.map((r) => r.id);
  const entries = await Promise.all(
    ids.map(async (id) => [id, await getMenuForRestaurant(id, scope)])
  );
  return Object.fromEntries(entries);
}
var UA2, cheerioLoadMemo;
var init_menu_extract = __esm({
  "api/lib/menu-extract.ts"() {
    init_pdf_day_extract();
    init_restaurants();
    init_date_fns_fi();
    UA2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  }
});

// api/lib/menu-api-routes.ts
function parseScope(s) {
  return s === "today" ? "today" : "week";
}
function normalizePath(pathname) {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/menus") return "/api/menus";
  if (path === "/menu") return "/api/menu";
  return path;
}
var menuExtractPromise = null;
function loadMenuExtract() {
  if (!menuExtractPromise) {
    menuExtractPromise = Promise.resolve().then(() => (init_menu_extract(), menu_extract_exports));
  }
  return menuExtractPromise;
}
async function handleMenuRoutes(pathname, searchParams, res) {
  const path = normalizePath(pathname);
  const { getAllMenus: getAllMenus2, getMenuForRestaurant: getMenuForRestaurant2 } = await loadMenuExtract();
  if (path === "/api/menus") {
    const scope = parseScope(searchParams.get("scope"));
    const result = await getAllMenus2(scope);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.end(JSON.stringify({ scope, items: result }));
    return true;
  }
  if (path === "/api/menu") {
    const id = searchParams.get("id");
    if (!id) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ kind: "error", message: "Parametri id puuttuu" }));
      return true;
    }
    const scope = parseScope(searchParams.get("scope"));
    const result = await getMenuForRestaurant2(id, scope);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.end(JSON.stringify(result));
    return true;
  }
  return false;
}

// scripts/api-entries/menu.ts
var config = {
  maxDuration: 60
};
async function handler(req, res) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const ok = await handleMenuRoutes(url.pathname, url.searchParams, res);
    if (!ok) {
      res.status(404).end("Not found");
    }
  } catch (e) {
    console.error("api/menu", e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          kind: "error",
          message: "Palvelinvirhe (lounaslista)."
        })
      );
    }
  }
}
export {
  config,
  handler as default
};
