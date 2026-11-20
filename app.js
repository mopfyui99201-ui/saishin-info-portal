/* 最新情報ポータル 静的閲覧版 */
const LS_PIN = "portal_pinned_urls";
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
function isNewItem(item, generatedAt) {
  const t = Date.parse((item.updated_at || "").replace(/\//g, "-"));
  const g = Date.parse((generatedAt || "").replace(/\//g, "-"));
  if (isNaN(t) || isNaN(g)) return false;
  return (g - t) <= 3 * 24 * 3600 * 1000;
}

function cardHtml(item, isPinned) {
  const badge = `🕒 公開・取得日時: ${esc(item.updated_at || "")}${item.source_type ? "　(" + esc(item.source_type) + ")" : ""}`;
  const newBadge = isNewItem(item, DATA.generated_at) ? '<span class="new-badge">🆕 NEW</span>' : "";
  const kws = (item.matched_keywords || []).map((k) => `<span class="kw-tag">🔍 #${esc(k)}</span>`).join("");
  const summary = (state.style !== "compact" && item.summary) ? `<div class="summary-box">${esc(item.summary)}</div>` : "";
  return `
  <div class="card-row">
    <button class="pin-btn ${isPinned ? "pinned" : ""}" data-url="${esc(item.url)}" title="📌 保存（要チェック）">${isPinned ? "📌" : "📍"}</button>
    <div class="portal-card">
      <div class="card-date">${esc(badge)}</div>
      <div><span class="site-badge">${esc(item.site_name || "情報元")}</span>${newBadge}</div>
      <div class="card-title">${esc(item.title || "無題")}</div>
      ${kws ? `<div>${kws}</div>` : ""}
      ${summary}
      <a class="open-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">🔗 元ページを開く</a>
    </div>
  </div>`;
}

function filteredItems() {
  let list = DATA.items.slice();
  if (state.site !== "全項目") list = list.filter((a) => a.site_name === state.site);
  const qs = parseKeywords(state.query);
  if (qs.length) {
    list = list.filter((a) => qs.some((q) =>
      (a.title || "").toLowerCase().includes(q) ||
      (a.summary || "").toLowerCase().includes(q) ||
      (a.site_name || "").toLowerCase().includes(q) ||
      (a.matched_keywords || []).some((k) => k.toLowerCase().includes(q))
    ));
  }
  if (state.sort === "site") {
    list.sort((x, y) => String(x.site_name).localeCompare(String(y.site_name), "ja") || String(y.updated_at).localeCompare(String(x.updated_at)));
  } else {
    list.sort((x, y) => String(y.updated_at).localeCompare(String(x.updated_at)));
  }
  // NEW優先
  list.sort((x, y) => (isNewItem(y, DATA.generated_at) ? 1 : 0) - (isNewItem(x, DATA.generated_at) ? 1 : 0));
  const total = list.length;
  if (state.limit === "10件") list = list.slice(0, 10);
  else if (state.limit === "30件") list = list.slice(0, 30);
  return { list, total };
}

function render() {
  // サイトピル
  const sites = [...new Set(DATA.items.map((a) => a.site_name).filter(Boolean))];
  $("pills").innerHTML = ["全項目", ...sites].map((s) =>
    `<button class="pill ${state.site === s ? "active" : ""}" data-site="${esc(s)}">${esc(s)}</button>`).join("");

  // ピン留め済みリスト
  const pinned = getPinned();
  const pinnedItems = pinned.map((u) => DATA.items.find((a) => a.url === u)).filter(Boolean);
  $("pinned").innerHTML = pinnedItems.length ? `
    <div class="pinned-section"><h2>📌 保存済みリスト（要チェック ${pinnedItems.length}件）</h2>
    ${pinnedItems.map((p) => cardHtml(p, true)).join("")}</div>` : "";

  const { list, total } = filteredItems();
  $("count").textContent = `📌 表示中: ${list.length} 件（該当: ${total} 件 / 総データ: ${DATA.items.length} 件）`;
  $("list").innerHTML = list.length ? list.map((a) => cardHtml(a, pinned.includes(a.url))).join("")
    : `<div class="empty">💡 条件に一致する情報はありません。</div>`;
}

function bind() {
  $("search").addEventListener("input", (e) => { state.query = e.target.value; render(); });
  $("limit").addEventListener("change", (e) => { state.limit = e.target.value; render(); });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("style").addEventListener("change", (e) => { state.style = e.target.value; render(); });
  document.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (pill) { state.site = pill.dataset.site; render(); return; }
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
    bind(); render();
  })
  .catch(() => {
    $("gen-info").textContent = "データの読み込みに失敗しました。";
    $("list").innerHTML = `<div class="empty">読み込みエラー</div>`;
  });
