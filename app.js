/* 最新情報ポータル 静的閲覧版 */
const LS_PIN = "portal_pinned_urls";
const LS_PIN_MEMO = "portal_pin_memos";
const LS_MYSITES = "portal_mysites";
const LS_MYITEMS = "portal_myitems";
const PIN_TAB = "📌 ピン留め";
let DATA = { items: [], maintenance: false, generated_at: "" };
let state = { site: "全項目", query: "", limit: "全件", sort: "new", style: "detail" };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function parseKeywords(str) {
  return (str || "").split(/[,、\s　]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
}
function getPinned() {
  try { return JSON.parse(localStorage.getItem(LS_PIN) || "[]"); } catch { return []; }
}
function setPinned(arr) { localStorage.setItem(LS_PIN, JSON.stringify(arr)); }
function getPinMemos() {
  try { return JSON.parse(localStorage.getItem(LS_PIN_MEMO) || "{}"); } catch { return {}; }
}
function setPinMemos(obj) { localStorage.setItem(LS_PIN_MEMO, JSON.stringify(obj)); }
function setPinMemo(url, memo) {
  const m = getPinMemos();
  if (memo) m[url] = memo; else delete m[url];
  setPinMemos(m);
}
function getMySites() {
  try { return JSON.parse(localStorage.getItem(LS_MYSITES) || "[]"); } catch { return []; }
}
function setMySites(arr) { localStorage.setItem(LS_MYSITES, JSON.stringify(arr)); }
function getMyItems() {
  try { return JSON.parse(localStorage.getItem(LS_MYITEMS) || "{}"); } catch { return {}; }
}
function setMyItems(obj) { localStorage.setItem(LS_MYITEMS, JSON.stringify(obj)); }
function isNewItem(item, generatedAt) {
  const t = Date.parse((item.updated_at || "").replace(/\//g, "-"));
  const g = Date.parse((generatedAt || "").replace(/\//g, "-"));
  if (isNaN(t) || isNaN(g)) return false;
  return (g - t) <= 3 * 24 * 3600 * 1000;
}
function fmtDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function dateFromStr(s) {
  const d = new Date(String(s || "").replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}

/* ---------- カード描画 ---------- */
function cardHtml(item, isPinned, isMy) {
  const badge = `🕒 公開・取得日時: ${esc(item.updated_at || "")}${item.source_type ? "　(" + esc(item.source_type) + ")" : ""}`;
  const newBadge = isNewItem(item, DATA.generated_at) ? '<span class="new-badge">🆕 NEW</span>' : "";
  const kws = (item.matched_keywords || []).map((k) => `<span class="kw-tag">🔍 #${esc(k)}</span>`).join("");
  const summary = (state.style !== "compact" && item.summary) ? `<div class="summary-box">${esc(item.summary)}</div>` : "";
  const delBtn = isMy ? `<button class="pin-btn mydel-btn" data-mysite="${esc(item._mysite)}" data-url="${esc(item.url)}" title="この記事を削除">🗑</button>` : "";
  return `
  <div class="card-row">
    <button class="pin-btn ${isPinned ? "pinned" : ""}" data-url="${esc(item.url)}" title="📌 保存（要チェック）">${isPinned ? "📌" : "📍"}</button>
    ${delBtn}
    <div class="portal-card">
      <div class="card-date">${esc(badge)}</div>
      <div><span class="site-badge" style="${isMy ? "background:#7c3aed;" : ""}">${esc(item.site_name || "情報元")}</span>${newBadge}</div>
      <div class="card-title">${esc(item.title || "無題")}</div>
      ${kws ? `<div>${kws}</div>` : ""}
      ${summary}
      <a class="open-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">🔗 元ページを開く</a>
    </div>
  </div>`;
}

/* ---------- 公式アイテム ---------- */
function filteredOfficial() {
  let list = DATA.items.slice();
  if (state.site !== "全項目" && state.site !== PIN_TAB && !state.site.startsWith("⭐")) {
    list = list.filter((a) => a.site_name === state.site);
  }
  const qs = parseKeywords(state.query);
  if (qs.length) {
    list = list.filter((a) => qs.some((q) =>
      (a.title || "").toLowerCase().includes(q) ||
      (a.summary || "").toLowerCase().includes(q) ||
      (a.site_name || "").toLowerCase().includes(q) ||
      (a.matched_keywords || []).some((k) => k.toLowerCase().includes(q))
    ));
  }
  return sortLimit(list);
}

/* ---------- マイアイテム ---------- */
function allMyItems() {
  const cache = getMyItems();
  const sites = getMySites();
  const out = [];
  for (const s of sites) {
    for (const it of (cache[s.id] || [])) {
      out.push({
        title: it.title, url: it.url, summary: it.summary || "",
        updated_at: it.updated_at || "", site_name: `⭐ ${s.name}`,
        source_type: "マイサイト", matched_keywords: s.category ? [s.category] : [],
        _mysite: s.id,
      });
    }
  }
  return out;
}
function filteredMy() {
  let list = allMyItems();
  if (state.site.startsWith("⭐")) {
    const name = state.site.slice(2);
    list = list.filter((a) => a.site_name === `⭐ ${name}`);
  }
  const qs = parseKeywords(state.query);
  if (qs.length) {
    list = list.filter((a) => qs.some((q) =>
      (a.title || "").toLowerCase().includes(q) ||
      (a.summary || "").toLowerCase().includes(q) ||
      (a.site_name || "").toLowerCase().includes(q) ||
      (a.matched_keywords || []).some((k) => k.toLowerCase().includes(q))
    ));
  }
  return sortLimit(list);
}
function sortLimit(list) {
  if (state.sort === "site") {
    list.sort((x, y) => String(x.site_name).localeCompare(String(y.site_name), "ja") || String(y.updated_at).localeCompare(String(x.updated_at)));
  } else {
    list.sort((x, y) => String(y.updated_at).localeCompare(String(x.updated_at)));
  }
  list.sort((x, y) => (isNewItem(y, DATA.generated_at) ? 1 : 0) - (isNewItem(x, DATA.generated_at) ? 1 : 0));
  const total = list.length;
  if (state.limit === "10件") list = list.slice(0, 10);
  else if (state.limit === "30件") list = list.slice(0, 30);
  return { list, total };
}

/* ---------- 描画 ---------- */
function pinnedEntryHtml(item) {
  const memo = getPinMemos()[item.url] || "";
  return `<div class="pin-entry">${cardHtml(item, true, !!item._mysite)}
    <div class="pin-memo-row"><span style="flex:0 0 auto;">📝 メモ:</span>
    <input class="pin-memo-input" data-url="${esc(item.url)}" value="${esc(memo)}" placeholder="この案件のメモを入力（入力すると自動保存）"></div>
  </div>`;
}

function render() {
  const pinned = getPinned();
  const allItems = DATA.items.concat(allMyItems());
  const pinnedItems = pinned.map((u) => allItems.find((a) => a.url === u)).filter(Boolean);
  $("pinned").innerHTML = pinnedItems.length ? `
    <div class="pinned-section"><h2>📌 保存済みリスト（要チェック ${pinnedItems.length}件）</h2>
    ${pinnedItems.map(pinnedEntryHtml).join("")}</div>` : "";

  // ピル: ピン留めタブ + 公式サイト + マイサイト
  const officialSites = [...new Set(DATA.items.map((a) => a.site_name).filter(Boolean))];
  const mySites = getMySites().map((s) => `⭐ ${s.name}`);
  const pills = ["全項目", PIN_TAB, ...officialSites, ...mySites];
  $("pills").innerHTML = pills.map((s) =>
    `<button class="pill ${state.site === s ? "active" : ""}" data-site="${esc(s)}">${s === PIN_TAB ? `${PIN_TAB}（${pinnedItems.length}件）` : esc(s)}</button>`).join("");

  const myCount = allMyItems().length;
  const totalAll = DATA.items.length + myCount;
  let shown = [], total = 0, listHtml = "";
  if (state.site === PIN_TAB) {
    shown = pinnedItems; total = pinnedItems.length;
    listHtml = shown.length ? shown.map(pinnedEntryHtml).join("")
      : `<div class="empty">📌 ピン留めされた項目はありません。各カードの📍ボタンで追加できます。</div>`;
  } else if (state.site === "全項目") {
    const o = filteredOfficial(); const m = filteredMy();
    shown = o.list.concat(m.list).slice(0, state.limit === "10件" ? 10 : state.limit === "30件" ? 30 : 1e9);
    total = o.total + m.total;
    listHtml = shown.length ? shown.map((a) => cardHtml(a, pinned.includes(a.url), !!a._mysite)).join("") : "";
  } else if (state.site.startsWith("⭐")) {
    const r = filteredMy(); shown = r.list; total = r.total;
    listHtml = shown.length ? shown.map((a) => cardHtml(a, pinned.includes(a.url), !!a._mysite)).join("") : "";
  } else {
    const r = filteredOfficial(); shown = r.list; total = r.total;
    listHtml = shown.length ? shown.map((a) => cardHtml(a, pinned.includes(a.url), !!a._mysite)).join("") : "";
  }
  $("count").textContent = `📌 表示中: ${shown.length} 件（該当: ${total} 件 / 総データ: ${totalAll} 件${myCount ? ` うちマイサイト: ${myCount} 件` : ""}）`;
  $("list").innerHTML = listHtml || `<div class="empty">💡 条件に一致する情報はありません。</div>`;
}

/* ---------- マイサイト管理 ---------- */
let editingId = null;
function renderMySites() {
  const sites = getMySites();
  const cache = getMyItems();
  $("my-list").innerHTML = sites.length ? sites.map((s) => {
    const n = (cache[s.id] || []).length;
    return `<div class="my-site-row">
      <span class="name">⭐ ${esc(s.name)}</span>
      ${s.category ? `<span class="cat">#${esc(s.category)}</span>` : ""}
      <button class="btn edit-btn" data-edit="${esc(s.id)}" style="padding:4px 10px;">✏️ 編集</button>
      <button class="btn danger" data-del="${esc(s.id)}" style="padding:4px 10px;">🗑 削除</button>
      <span class="url">${esc(s.url)}${n ? `　取得済み ${n} 件` : ""}</span>
    </div>`;
  }).join("") : `<div class="my-status">まだマイサイトは登録されていません。</div>`;
}
function myMsg(text, ok) {
  const el = $("my-msg");
  el.textContent = text; el.className = "my-msg " + (ok ? "ok" : "err");
}
function myStatus(text) { $("my-status").textContent = text; }

function resetEditForm() {
  editingId = null;
  $("my-add").textContent = "💾 登録して取得";
  $("my-cancel-edit").style.display = "none";
}
function editMySite(id) {
  const s = getMySites().find((x) => x.id === id);
  if (!s) return;
  editingId = id;
  $("my-name").value = s.name;
  $("my-url").value = s.url;
  $("my-cat").value = s.category || "";
  $("my-add").textContent = "💾 更新して保存";
  $("my-cancel-edit").style.display = "inline-block";
  $("mypanel").open = true;
  $("my-name").focus();
  myMsg(`「${s.name}」を編集中です。修正後「💾 更新して保存」を押してください。`, true);
}
function cancelEdit() {
  resetEditForm();
  $("my-name").value = ""; $("my-url").value = ""; $("my-cat").value = "";
  myMsg("", true);
}
function addMySite() {
  const name = $("my-name").value.trim();
  const url = $("my-url").value.trim();
  const cat = $("my-cat").value.trim();
  if (!name || !url) { myMsg("サイト名とURL（またはキーワード）を入力してください。", false); return; }
  const sites = getMySites();
  if (editingId) {
    const s = sites.find((x) => x.id === editingId);
    if (s) {
      if (sites.some((x) => x.id !== editingId && x.url === url)) { myMsg("同じURL/キーワードが既に登録されています。", false); return; }
      s.name = name; s.url = url; s.category = cat;
      setMySites(sites);
      myMsg(`「${name}」を更新しました。🔄更新で記事を再取得できます。`, true);
      resetEditForm(); renderMySites(); render(); return;
    }
    editingId = null;
  }
  if (sites.some((s) => s.url === url)) { myMsg("同じURL/キーワードは既に登録されています。", false); return; }
  const site = { id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, url, category: cat };
  sites.push(site); setMySites(sites);
  $("my-name").value = ""; $("my-url").value = ""; $("my-cat").value = "";
  myMsg(`「${name}」を登録しました。🔄更新で記事を取得できます。`, true);
  renderMySites();
}
function deleteMySite(id) {
  setMySites(getMySites().filter((s) => s.id !== id));
  const cache = getMyItems(); delete cache[id]; setMyItems(cache);
  if (editingId === id) cancelEdit();
  renderMySites(); render();
}
function deleteMyItem(siteId, url) {
  const cache = getMyItems();
  if (cache[siteId]) {
    cache[siteId] = cache[siteId].filter((it) => it.url !== url);
    setMyItems(cache);
  }
  // ピン留め・メモも連動して削除
  const pins = getPinned().filter((u) => u !== url);
  setPinned(pins);
  setPinMemo(url, "");
  renderMySites(); render();
}

/* ---------- 外部取得（CORSプロキシ経由） ---------- */
const PROXIES = [
  (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://cors.isomorphic-git.org/${u}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];
async function fetchText(url) {
  let lastErr;
  for (const mk of PROXIES) {
    try {
      const r = await fetch(mk(url), { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      let t = await r.text();
      // allorigins /get はJSONラップなので中身を取り出す
      const trimmed = t.trim();
      if (trimmed.startsWith("{")) {
        try {
          const j = JSON.parse(trimmed);
          if (typeof j.contents === "string") t = j.contents;
        } catch { /* JSONでなければそのまま */ }
      }
      if (t && t.length > 50) return t;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("取得失敗");
}
function looksLikeFeed(url) {
  return /\.(xml|rss|atom)(\?|$)/i.test(url) || /feed|rss|atom/i.test(url);
}
function googleNewsRss(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
}
function parseFeed(xmlText, baseUrl) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML解析エラー");
  const items = [];
  const nodes = doc.querySelectorAll("item, entry");
  nodes.forEach((n) => {
    const title = (n.querySelector("title")?.textContent || "").trim();
    let link = "";
    const atomLink = n.querySelector('link[rel="alternate"], link:not([rel])');
    if (atomLink?.getAttribute("href")) link = atomLink.getAttribute("href");
    else link = (n.querySelector("link")?.textContent || "").trim();
    const dateStr = n.querySelector("pubDate, published, updated, dc\\:date")?.textContent || "";
    const d = new Date(dateStr);
    items.push({
      title: title || "無題",
      url: link || baseUrl,
      summary: (n.querySelector("description")?.textContent || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim().slice(0, 300),
      updated_at: isNaN(d.getTime()) ? "" : fmtDate(d),
      ts: isNaN(d.getTime()) ? 0 : d.getTime(),
    });
  });
  return items;
}
const NAV_NOISE = /ホーム|お問い合わせ|サイトマップ|プライバシー|ページトップ|上へ|戻る|ログイン|新規登録|English|サイト内検索|メニュー|copyright/i;
function parseHtmlLinks(htmlText, pageUrl) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const base = doc.querySelector("base")?.getAttribute("href") || pageUrl;
  const pageTitle = (doc.querySelector("title")?.textContent || "").trim();
  const desc = doc.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute("content") || "";
  // RSS自動検出
  const feedLink = doc.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"]')?.getAttribute("href");
  const main = doc.querySelector("main, article, #main, #contents, .contents, .main, .content") || doc.body;
  const seen = new Set();
  const items = [];
  const anchors = main ? main.querySelectorAll("a[href]") : [];
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
    let abs;
    try { abs = new URL(href, base).href; } catch { continue; }
    if (seen.has(abs)) continue;
    const text = (a.textContent || a.querySelector("img")?.alt || "").trim().replace(/\s+/g, " ");
    if (text.length < 4 || text.length > 120 || NAV_NOISE.test(text)) continue;
    if (/\.(css|js|png|jpe?g|gif|svg|ico|zip|exe)(\?|$)/i.test(abs)) continue;
    seen.add(abs);
    // 近傍の見出しっぽいテキストをサマリーに
    let ctx = "";
    let p = a.parentElement;
    for (let i = 0; i < 3 && p; i++) {
      const t = (p.textContent || "").trim().replace(/\s+/g, " ");
      if (t.length > text.length + 10) { ctx = t.slice(0, 200); break; }
      p = p.parentElement;
    }
    items.push({ title: text, url: abs, summary: ctx || desc.slice(0, 200), updated_at: "", ts: 0 });
    if (items.length >= 15) break;
  }
  return { items, pageTitle, feedLink: feedLink ? new URL(feedLink, base).href : null, desc };
}
async function fetchMySite(site) {
  const input = site.url.trim();
  const isUrl = /^https?:\/\//i.test(input);
  if (!isUrl) {
    // 検索キーワード → GoogleニュースRSS
    const xml = await fetchText(googleNewsRss(input));
    return parseFeed(xml, input);
  }
  if (looksLikeFeed(input)) {
    const xml = await fetchText(input);
    return parseFeed(xml, input);
  }
  const html = await fetchText(input);
  const parsed = parseHtmlLinks(html, input);
  if (parsed.feedLink) {
    try {
      const xml = await fetchText(parsed.feedLink);
      const feedItems = parseFeed(xml, input);
      if (feedItems.length) return feedItems;
    } catch { /* フィード取得失敗時はHTMLリンクにフォールバック */ }
  }
  if (parsed.items.length) return parsed.items;
  // リンクが取れない場合はページ自体を1件として返す
  return [{
    title: parsed.pageTitle || input, url: input,
    summary: parsed.desc || "ページを開きました（記事リンクは検出されませんでした）",
    updated_at: "", ts: 0,
  }];
}
async function refreshMySites(specificId) {
  const sites = getMySites().filter((s) => !specificId || s.id === specificId);
  if (!sites.length) { myMsg("登録サイトがありません。", false); return; }
  const cache = getMyItems();
  myStatus(`取得中...（${sites.length} サイト）`);
  myMsg("", true);
  let ok = 0, ng = 0;
  for (const s of sites) {
    try {
      let items = await fetchMySite(s);
      items = items.filter((it) => it.url).slice(0, 20);
      // 日付なしは現在時刻扱いでソート可能に
      items.forEach((it) => { if (!it.updated_at) it.updated_at = fmtDate(new Date()); });
      cache[s.id] = items;
      ok++;
    } catch (e) {
      cache[s.id] = cache[s.id] || [];
      ng++;
    }
    myStatus(`取得中... ${ok + ng}/${sites.length}`);
  }
  setMyItems(cache);
  myStatus(`最終更新: ${fmtDate(new Date())}　成功 ${ok} / 失敗 ${ng}`);
  myMsg(ng ? `${ng} サイトは取得に失敗しました（プロキシ制限やサイト側のCORS/構造の問題の可能性）。` : "全サイトの取得が完了しました。", !ng);
  renderMySites(); render();
}

/* ---------- 書き出し/復元 ---------- */
function exportMyData() {
  const payload = { sites: getMySites(), items: getMyItems(), exported_at: fmtDate(new Date()) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mysites_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  myMsg("マイサイトデータを書き出しました。", true);
}
function importMyData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.sites)) throw new Error("形式が不正です");
      const sites = getMySites().concat(d.sites.filter((ns) => !getMySites().some((os) => os.url === ns.url)));
      setMySites(sites);
      const cache = getMyItems();
      Object.assign(cache, d.items || {});
      setMyItems(cache);
      renderMySites(); render();
      myMsg(`${d.sites.length} サイトを復元しました。`, true);
    } catch (e) { myMsg("復元に失敗しました: " + e.message, false); }
  };
  reader.readAsText(file);
}

/* ---------- イベント ---------- */
function bind() {
  $("search").addEventListener("input", (e) => { state.query = e.target.value; render(); });
  $("limit").addEventListener("change", (e) => { state.limit = e.target.value; render(); });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("style").addEventListener("change", (e) => { state.style = e.target.value; render(); });
  $("my-add").addEventListener("click", addMySite);
  $("my-cancel-edit").addEventListener("click", cancelEdit);
  $("my-refresh").addEventListener("click", () => refreshMySites());
  $("my-export").addEventListener("click", exportMyData);
  $("my-import").addEventListener("click", () => $("my-import-file").click());
  $("my-import-file").addEventListener("change", (e) => {
    if (e.target.files[0]) importMyData(e.target.files[0]);
    e.target.value = "";
  });
  document.addEventListener("input", (e) => {
    const memo = e.target.closest(".pin-memo-input");
    if (memo) setPinMemo(memo.dataset.url, memo.value);
  });
  document.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (pill) { state.site = pill.dataset.site; render(); return; }
    const del = e.target.closest("[data-del]");
    if (del) { deleteMySite(del.dataset.del); return; }
    const edit = e.target.closest("[data-edit]");
    if (edit) { editMySite(edit.dataset.edit); return; }
    const mydel = e.target.closest(".mydel-btn");
    if (mydel) { deleteMyItem(mydel.dataset.mysite, mydel.dataset.url); return; }
    const btn = e.target.closest(".pin-btn");
    if (btn) {
      const url = btn.dataset.url;
      let arr = getPinned();
      if (arr.includes(url)) { arr = arr.filter((u) => u !== url); }
      else { arr.push(url); }
      setPinned(arr); render();
    }
  });
}

fetch("data.json")
  .then((r) => r.json())
  .then((d) => {
    DATA = d;
    if (DATA.maintenance) {
      document.querySelector(".wrap").innerHTML = `
        <div class="maintenance"><h1>🌐 最新情報ポータル</h1>
        <p>現在メンテナンス中です。しばらくしてから再度アクセスしてください。</p></div>`;
      return;
    }
    $("gen-info").textContent = `複数サイトの最新トピックを一元表示　🕒 データ生成: ${DATA.generated_at || "-"}`;
    renderMySites(); bind(); render();
  })
  .catch(() => {
    $("gen-info").textContent = "データの読み込みに失敗しました。";
    $("list").innerHTML = `<div class="empty">読み込みエラー</div>`;
  });
