// Reusable page pieces. Sections compose pages from these so the look stays consistent.
import { $, $$, esc, icon, color, pct } from './util.js';
import { section } from './router.js';
import { DB } from './data.js';
import { prefs, savePrefs } from './store.js';

export const lvTag = lv => lv ? `<span class="lv">${esc(lv)}</span>` : '';
export const bar = p => `<div class="bar"><i style="width:${p}%"></i></div>`;

// title row; back = [label, '#/path'] adds a back link above it
export function pageHead(id, title, sub, back) {
  const s = section(id) || {};
  return (back ? `<a class="back-link" href="${back[1]}">${icon('back')}<span>${esc(back[0])}</span></a>` : '') +
    `<div class="page-head" style="${color(s.color || id)}"><span class="badge-ic">${icon(s.icon || 'more')}</span><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
}

// N5 … N1 selector; levels marked unavailable in the manifest are shown locked ("Sắp có")
export function levelBar(current, href, counts = {}) {
  const order = ['N5', 'N4', 'N3', 'N2', 'N1'];
  return `<nav class="levels" aria-label="Cấp độ">${order.map(id => {
    const L = DB.levels.find(l => l.id === id) || { id, available: false };
    const c = counts[id];
    if (!L.available) return `<span class="lvbtn locked" title="${esc(L.note || 'Sắp có')}">${icon('lock')}<b>${id}</b><small>${esc(L.note || 'Sắp có')}</small></span>`;
    return `<a class="lvbtn${id === current ? ' on' : ''}" href="${href(id)}" ${id === current ? 'aria-current="page"' : ''}><b>${id}</b>${c ? `<small>${c[0]}/${c[1]}</small>` : ''}</a>`;
  }).join('')}</nav>`;
}

// grid of cards: items = [{href, title, sub, done, total, badge, cls}]
export function cardGrid(items, cls = '') {
  return `<div class="cgrid ${cls}">${items.map(it => {
    const p = pct(it.done || 0, it.total || 0);
    const inner = `${it.badge ? `<span class="cbadge">${it.badge}</span>` : ''}<b>${esc(it.title)}</b>${it.sub ? `<span class="small muted">${esc(it.sub)}</span>` : ''}${it.total ? bar(p) + `<span class="small muted">Đã thuộc ${it.done}/${it.total}</span>` : ''}`;
    return it.href ? `<a class="ccard ${it.cls || ''}" href="${it.href}" data-text="${esc((it.title + ' ' + (it.sub || '')).toLowerCase())}">${inner}</a>`
      : `<div class="ccard disabled ${it.cls || ''}">${inner}</div>`;
  }).join('')}</div>`;
}

// segmented buttons bound to a prefs key; onChange re-renders
export const seg = (key, items, cur) => `<div class="seg">${items.map(([v, n]) => `<button type="button" data-k="${key}" data-v="${esc(v)}" aria-pressed="${cur === v}">${esc(n)}</button>`).join('')}</div>`;
export function bindSeg(root, onChange) {
  $$('[data-k]', root).forEach(b => b.onclick = () => { prefs[b.dataset.k] = b.dataset.v; savePrefs(); onChange(); });
}

// filter cards inside root by a search box
export function bindCardSearch(root, input) {
  input.oninput = () => { const q = input.value.trim().toLowerCase(); $$('.ccard[data-text]', root).forEach(c => c.hidden = q && !c.dataset.text.includes(q)); };
}

// searchable list: rows = [{text, html}]
export function listSearch(root, rows) {
  const box = document.createElement('div');
  box.innerHTML = `<label class="field"><span class="flabel">Tìm kiếm</span><input type="search" class="listq" placeholder="Gõ chữ Nhật, cách đọc hoặc nghĩa…" value="${esc(prefs.listQ || '')}"></label><div class="card wl" style="margin-top:12px"></div>`;
  root.appendChild(box);
  const out = $('.wl', box), input = $('.listq', box);
  const draw = () => {
    const q = input.value.trim().toLowerCase(), hit = q ? rows.filter(r => r.text.toLowerCase().includes(q)) : rows;
    out.innerHTML = hit.length ? `<div class="wlist">${hit.slice(0, 400).map(r => r.html).join('')}</div>${hit.length > 400 ? `<p class="small muted">Hiện 400 / ${hit.length} mục. Gõ thêm để lọc.</p>` : ''}` : '<p class="muted">Không tìm thấy.</p>';
  };
  input.oninput = () => { prefs.listQ = input.value; savePrefs(); draw(); };
  draw();
}
