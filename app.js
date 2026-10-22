/* Ôn JLPT N3 — flashcards and fill-in-the-blank drills over data/*.json.
   Progress and the mistake book live in this browser (localStorage) and can be exported / imported as a JSON file. */
'use strict';
const EXAM = new Date(2026, 11, 6);          // JLPT 06/12/2026
const KEY = 'jlpt-web-v1', UIKEY = 'jlpt-web-ui-v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const HAS_KANJI = /[一-鿿々]/;
const SEC_NAME = { vocab: 'Từ vựng', kanji: 'Kanji', grammar: 'Ngữ pháp', sent: 'Mẫu câu', read: 'Đọc hiểu' };

// ---------------- storage
function loadJSON(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
let S = loadJSON(KEY, {});
S.r = S.r || {}; S.m = S.m || {}; S.day = S.day || {};
let UI = Object.assign({ tab: 'home', vTopic: 'all', vLv: 'all', vMode: 'mean', kLv: 'all', kMode: 'hv', gLv: 'all', sKind: 'all', view: {} }, loadJSON(UIKEY, {}));
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
function saveUI() { try { localStorage.setItem(UIKEY, JSON.stringify(UI)); } catch (e) { } }
const today = () => new Date().toISOString().slice(0, 10);
function record(id, sec, ok, label) {
  const r = S.r[id] || (S.r[id] = { c: 0, w: 0, s: 0 });
  if (ok) { r.c++; r.s++; } else { r.w++; r.s = 0; S.m[id] = { sec, n: (S.m[id] ? S.m[id].n : 0) + 1, t: Date.now(), label }; }
  if (ok && S.m[id] && r.s >= 2) delete S.m[id];         // two right answers in a row clear a mistake
  const d = S.day[today()] || (S.day[today()] = { n: 0, ok: 0 }); d.n++; if (ok) d.ok++;
  save(); badge();
}
const learned = id => S.r[id] && S.r[id].s >= 2;
function badge() { const n = Object.keys(S.m).length; $('#missBadge').textContent = n ? n : ''; }

// ---------------- data
const DB = {};
async function loadData() {
  const names = ['topics', 'vocab', 'kanji', 'grammar', 'sentences', 'reading'];
  const res = await Promise.all(names.map(n => fetch('data/' + n + '.json').then(r => { if (!r.ok) throw new Error(n); return r.json(); })));
  names.forEach((n, i) => DB[n] = res[i]);
  DB.vById = Object.fromEntries(DB.vocab.map(v => [v.id, v]));
  DB.kById = Object.fromEntries(DB.kanji.map(k => [k.id, k]));
  DB.gq = []; DB.grammar.forEach(g => g.q.forEach((q, i) => DB.gq.push({ id: g.id + '.' + i, g, q })));
  DB.gqById = Object.fromEntries(DB.gq.map(x => [x.id, x]));
  DB.sById = Object.fromEntries(DB.sentences.map(s => [s.id, s]));
  DB.topicName = Object.fromEntries(DB.topics.map(t => [t.id, t.name]));
}

// ---------------- countdown
function daysLeft() {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((EXAM - t) / 86400000);
}

// ---------------- generic quiz card
// q = {id, sec, label, prompt (html), ask, opts: [text], answer (index), jpOpts (bool), explain (html)}
function pickItem(pool, idOf) {
  const miss = pool.filter(x => S.m[idOf(x)]), fresh = pool.filter(x => !S.r[idOf(x)]), weak = pool.filter(x => S.r[idOf(x)] && !learned(idOf(x)));
  const r = Math.random();
  if (miss.length && r < 0.3) return pick(miss);
  if (weak.length && r < 0.55) return pick(weak);
  if (fresh.length && r < 0.92) return pick(fresh);
  return pick(pool);
}
function quiz(el, makeQ, sess) {
  sess = sess || { n: 0, ok: 0 };
  const q = makeQ();
  if (!q) { el.innerHTML = '<div class="empty">Không có câu hỏi phù hợp với bộ lọc này. Hãy chọn phạm vi khác.</div>'; return; }
  const order = shuffle(q.opts.map((t, i) => i));
  el.innerHTML = `<div class="card" role="group" aria-label="Câu hỏi">
    <div class="card-top"><span>${esc(q.tag || '')}</span><span>Lượt này: ${sess.ok}/${sess.n} đúng</span></div>
    <div class="prompt">${q.prompt}<div class="ask">${esc(q.ask)}</div></div>
    <div class="opts">${order.map((i, k) => `<button type="button" class="opt${q.jpOpts ? ' jp' : ''}" data-i="${i}"><span class="k">${k + 1}</span><span>${esc(q.opts[i])}</span></button>`).join('')}</div>
    <div class="explain" hidden></div>
    <div class="row" hidden><button type="button" class="btn next">Câu tiếp</button><span class="muted small">Phím 1–4 để chọn, Enter để qua câu</span></div>
  </div>`;
  const card = $('.card', el), btns = [...card.querySelectorAll('.opt')];
  let done = false;
  const choose = b => {
    if (done) return; done = true;
    const i = +b.dataset.i, ok = i === q.answer;
    btns.forEach(x => { x.disabled = true; if (+x.dataset.i === q.answer) x.classList.add('right'); });
    if (!ok) b.classList.add('wrong');
    sess.n++; if (ok) sess.ok++;
    record(q.id, q.sec, ok, q.label);
    const ex = $('.explain', card); ex.hidden = false;
    ex.innerHTML = `<div class="verdict ${ok ? 'ok' : 'bad'}">${ok ? 'Đúng rồi!' : 'Chưa đúng — đáp án: ' + esc(q.opts[q.answer])}</div>${q.explain || ''}`;
    const row = card.querySelector('.row'); row.hidden = false;
    $('.next', card).focus();
  };
  btns.forEach(b => b.addEventListener('click', () => choose(b)));
  $('.next', card).addEventListener('click', () => quiz(el, makeQ, sess));
  el._keys = e => {
    if (e.target.closest('input, textarea, select')) return;
    if (!done && /^[1-4]$/.test(e.key) && btns[+e.key - 1]) { choose(btns[+e.key - 1]); e.preventDefault(); }
    else if (done && (e.key === 'Enter' || e.key === ' ')) { quiz(el, makeQ, sess); e.preventDefault(); }
  };
  KEYS = el._keys;
}
let KEYS = null;
document.addEventListener('keydown', e => { if (KEYS) KEYS(e); });
function distract(answer, pool, n = 3) {
  const out = [], seen = new Set([answer]);
  for (const x of shuffle(pool)) { if (x && !seen.has(x)) { seen.add(x); out.push(x); if (out.length === n) break; } }
  return out;
}
const lvTag = lv => lv ? `<span class="lv">${esc(lv)}</span>` : '';

// ---------------- vocabulary
function vocabPool() {
  return DB.vocab.filter(v => (UI.vTopic === 'all' || v.t === UI.vTopic) && (UI.vLv === 'all' || v.lv === UI.vLv));
}
function vocabExplain(v) {
  return `<div class="jp">${esc(v.w)}${v.r ? '【' + esc(v.r) + '】' : ''}${lvTag(v.lv)}</div><div>${esc(v.vi)}</div>
    ${v.ex ? `<div class="jp muted small">${esc(v.ex)}</div>` : ''}<div class="muted small">Chủ đề: ${esc(DB.topicName[v.t] || v.t)}</div>`;
}
function vocabQ() {
  let pool = vocabPool();
  const mode = UI.vMode;
  if (mode === 'read') pool = pool.filter(v => HAS_KANJI.test(v.w) && v.r);
  if (!pool.length) return null;
  const v = pickItem(pool, x => x.id);
  const near = DB.vocab.filter(x => x.t === v.t && x.id !== v.id);
  const lvPool = DB.vocab.filter(x => x.lv === v.lv && x.id !== v.id);
  let opts, prompt, ask, jp = false;
  if (mode === 'mean') {
    opts = [v.vi, ...distract(v.vi, near.map(x => x.vi).concat(lvPool.slice(0, 400).map(x => x.vi)))];
    prompt = `<div class="big-jp">${esc(v.w)}</div>${v.r && HAS_KANJI.test(v.w) ? `<div class="jp muted">${esc(v.r)}</div>` : ''}`;
    ask = 'Chọn nghĩa đúng';
  } else if (mode === 'read') {
    const same = lvPool.filter(x => x.r && Math.abs(x.r.length - v.r.length) <= 1).map(x => x.r);
    opts = [v.r, ...distract(v.r, same.length > 10 ? same : lvPool.map(x => x.r).filter(Boolean))];
    prompt = `<div class="big-jp">${esc(v.w)}</div>`; ask = 'Chọn cách đọc đúng'; jp = true;
  } else {
    opts = [v.w, ...distract(v.w, near.map(x => x.w).concat(lvPool.slice(0, 300).map(x => x.w)))];
    prompt = `<div style="font-size:22px;font-weight:600">${esc(v.vi)}</div>`; ask = 'Chọn từ tiếng Nhật đúng'; jp = true;
  }
  if (opts.length < 4) return null;
  return { id: v.id, sec: 'vocab', label: v.w + ' — ' + v.vi, tag: (DB.topicName[v.t] || '') + ' · ' + v.lv, prompt, ask, opts, answer: 0, jpOpts: jp, explain: vocabExplain(v) };
}
function vocabList(el) {
  const pool = vocabPool();
  el.innerHTML = `<div class="list">${pool.slice(0, 600).map(v => `<div class="word-row"><span class="jp">${esc(v.w)}${learned(v.id) ? ' ✓' : ''}</span><span>${v.r ? `<span class="jp muted">${esc(v.r)}</span> · ` : ''}${esc(v.vi)}${lvTag(v.lv)}</span></div>`).join('')}</div>
    ${pool.length > 600 ? `<p class="muted small">Đang hiện 600 / ${pool.length} từ. Chọn một chủ đề để xem đủ.</p>` : ''}`;
}
function renderVocab(main) {
  const groups = {};
  DB.topics.forEach(t => (groups[t.group] = groups[t.group] || []).push(t));
  const cnt = {}, done = {};
  DB.vocab.forEach(v => { cnt[v.t] = (cnt[v.t] || 0) + 1; if (learned(v.id)) done[v.t] = (done[v.t] || 0) + 1; });
  const cur = UI.vTopic === 'all' ? 'Tất cả chủ đề' : DB.topicName[UI.vTopic];
  main.innerHTML = `<h1>Từ vựng</h1>
  <details class="panel" ${UI.vTopic === 'all' ? 'open' : ''}><summary>Chủ đề: ${esc(cur)}</summary>
    <div class="topics">
      <button type="button" class="chip" data-topic="all" aria-pressed="${UI.vTopic === 'all'}">Tất cả (${DB.vocab.length})</button>
      ${Object.entries(groups).map(([g, ts]) => `<div class="group-label">${esc(g)}</div>` + ts.map(t =>
        `<button type="button" class="chip" data-topic="${t.id}" aria-pressed="${UI.vTopic === t.id}">${esc(t.name)} · ${done[t.id] || 0}/${cnt[t.id] || 0}</button>`).join('')).join('')}
    </div></details>
  <div class="toolbar">${['all', 'N5', 'N4', 'N3'].map(l => `<button type="button" class="chip" data-lv="${l}" aria-pressed="${UI.vLv === l}">${l === 'all' ? 'Mọi cấp' : l}</button>`).join('')}</div>
  <div class="toolbar">${[['mean', 'Từ → nghĩa'], ['read', 'Kanji → cách đọc'], ['rev', 'Nghĩa → từ'], ['list', 'Danh sách']].map(([m, n]) =>
    `<button type="button" class="chip" data-mode="${m}" aria-pressed="${UI.vMode === m}">${n}</button>`).join('')}</div>
  <div id="stage"></div>`;
  main.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => { UI.vTopic = b.dataset.topic; saveUI(); render(); });
  main.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { UI.vLv = b.dataset.lv; saveUI(); render(); });
  main.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { UI.vMode = b.dataset.mode; saveUI(); render(); });
  const st = $('#stage', main);
  if (UI.vMode === 'list') vocabList(st); else quiz(st, vocabQ);
}

// ---------------- kanji
function kanjiPool() { return DB.kanji.filter(k => UI.kLv === 'all' || k.lv === UI.kLv); }
function kanjiExplain(k) {
  return `<div class="row"><span class="big-kanji">${esc(k.k)}</span><div><div style="font-weight:700">${esc(k.hv)} ${lvTag(k.lv)}</div>
    <div class="small">Âm On: <span class="jp">${esc(k.on || '—')}</span></div><div class="small">Âm Kun: <span class="jp">${esc(k.kun || '—')}</span></div></div></div>
    ${k.story ? `<div class="story">${esc(k.story)}</div>` : ''}
    <div class="words">${k.words.map(w => `<div class="word-row"><span class="jp">${esc(w.w)}</span><span><span class="jp muted">${esc(w.r)}</span>${w.vi ? ' · ' + esc(w.vi) : ''}${lvTag(w.lv)}</span></div>`).join('')}</div>`;
}
function kanjiQ() {
  const pool = kanjiPool(); if (!pool.length) return null;
  const k = pickItem(pool, x => x.id), mode = UI.kMode;
  const tag = 'Kanji ' + k.lv;
  if (mode === 'hv') {
    const opts = [k.hv, ...distract(k.hv, DB.kanji.filter(x => x.lv === k.lv).map(x => x.hv))];
    return { id: k.id, sec: 'kanji', label: k.k + ' ' + k.hv, tag, prompt: `<div class="big-kanji">${esc(k.k)}</div>`, ask: 'Chọn âm Hán Việt', opts, answer: 0, explain: kanjiExplain(k) };
  }
  const words = k.words.filter(w => w.r && (mode === 'wread' || w.vi) && HAS_KANJI.test(w.w));
  if (!words.length) return kanjiQ.retry++ < 20 ? kanjiQ() : null;
  kanjiQ.retry = 0;
  const w = pick(words);
  const others = DB.kanji.filter(x => x.lv === k.lv && x.id !== k.id).flatMap(x => x.words);
  const hl = esc(w.w).split(k.k).join(`<span style="color:var(--accent)">${esc(k.k)}</span>`);
  if (mode === 'wread') {
    const same = others.filter(x => x.r && Math.abs(x.r.length - w.r.length) <= 1).map(x => x.r);
    return { id: k.id, sec: 'kanji', label: w.w + ' (' + k.k + ')', tag, prompt: `<div class="big-jp">${hl}</div>`, ask: 'Chọn cách đọc của từ ghép', opts: [w.r, ...distract(w.r, same)], answer: 0, jpOpts: true, explain: kanjiExplain(k) };
  }
  return { id: k.id, sec: 'kanji', label: w.w + ' (' + k.k + ')', tag, prompt: `<div class="big-jp">${hl}</div><div class="jp muted">${esc(w.r)}</div>`, ask: 'Từ ghép này nghĩa là gì?', opts: [w.vi, ...distract(w.vi, others.map(x => x.vi))], answer: 0, explain: kanjiExplain(k) };
}
kanjiQ.retry = 0;
function kanjiList(el) {
  el.innerHTML = `<div class="list">${kanjiPool().map(k => `<details class="word-row" style="display:block"><summary><span class="jp" style="font-size:22px">${esc(k.k)}</span> <b>${esc(k.hv)}</b>${lvTag(k.lv)}${learned(k.id) ? ' ✓' : ''} <span class="muted small">${k.words.slice(0, 4).map(w => esc(w.w)).join('、')}</span></summary>${kanjiExplain(k)}</details>`).join('')}</div>`;
}
function renderKanji(main) {
  main.innerHTML = `<h1>Kanji</h1>
  <p class="muted small">Mỗi chữ kèm các từ ghép lấy từ kho từ vựng N5–N3 (từ được tạo thành khi ghép Kanji).</p>
  <div class="toolbar">${['all', 'N5', 'N4', 'N3'].map(l => `<button type="button" class="chip" data-lv="${l}" aria-pressed="${UI.kLv === l}">${l === 'all' ? 'Mọi cấp' : l}</button>`).join('')}</div>
  <div class="toolbar">${[['hv', 'Chữ → Hán Việt'], ['word', 'Từ ghép → nghĩa'], ['wread', 'Từ ghép → cách đọc'], ['list', 'Danh sách']].map(([m, n]) =>
    `<button type="button" class="chip" data-mode="${m}" aria-pressed="${UI.kMode === m}">${n}</button>`).join('')}</div>
  <div id="stage"></div>`;
  main.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { UI.kLv = b.dataset.lv; saveUI(); render(); });
  main.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { UI.kMode = b.dataset.mode; saveUI(); render(); });
  const st = $('#stage', main);
  if (UI.kMode === 'list') kanjiList(st); else quiz(st, kanjiQ);
}

// ---------------- grammar
function grammarExplain(g) {
  return `<div class="jp" style="font-weight:700">${esc(g.p)}${lvTag(g.lv)}</div><div>${esc(g.mean)}</div>
    ${g.struct ? `<div class="small muted">Cấu trúc: <span class="jp">${esc(g.struct)}</span></div>` : ''}
    ${g.ex.slice(0, 2).map(e => `<div class="jp small">${esc(e.jp)}</div>${e.vi ? `<div class="small muted">${esc(e.vi)}</div>` : ''}`).join('')}`;
}
function grammarQ(list) {
  const pool = list || DB.gq.filter(x => UI.gLv === 'all' || x.g.lv === UI.gLv);
  if (!pool.length) return null;
  const x = pickItem(pool, y => y.id);
  return { id: x.id, sec: 'grammar', label: x.g.p, tag: 'Ngữ pháp ' + x.g.lv + (x.g.grp ? ' · ' + x.g.grp : ''),
    prompt: `<div class="q-jp">${esc(x.q.s).replace('（　　）', '<span class="blank">（　　）</span>')}</div>`, ask: 'Chọn từ / mẫu điền vào chỗ trống',
    opts: [x.q.a, ...x.q.d], answer: 0, jpOpts: true, explain: grammarExplain(x.g) };
}
function grammarList(el) {
  const gs = DB.grammar.filter(g => UI.gLv === 'all' || g.lv === UI.gLv);
  el.innerHTML = `<div class="list">${gs.map(g => `<details class="word-row" style="display:block"><summary><span class="jp"><b>${esc(g.p)}</b></span>${lvTag(g.lv)} <span class="muted small">${esc(g.mean.slice(0, 70))}</span></summary>${grammarExplain(g)}</details>`).join('')}</div>`;
}
function renderGrammar(main) {
  const mode = UI.view.grammar || 'quiz';
  main.innerHTML = `<h1>Ngữ pháp</h1>
  <div class="toolbar">${['all', 'N5', 'N4', 'N3'].map(l => `<button type="button" class="chip" data-lv="${l}" aria-pressed="${UI.gLv === l}">${l === 'all' ? 'Mọi cấp' : l}</button>`).join('')}
    <button type="button" class="chip" data-view="quiz" aria-pressed="${mode === 'quiz'}">Điền chỗ trống</button>
    <button type="button" class="chip" data-view="list" aria-pressed="${mode === 'list'}">Danh sách mẫu</button></div>
  <div id="stage"></div>`;
  main.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { UI.gLv = b.dataset.lv; saveUI(); render(); });
  main.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { UI.view.grammar = b.dataset.view; saveUI(); render(); });
  const st = $('#stage', main);
  if (mode === 'list') grammarList(st); else quiz(st, () => grammarQ());
}

// ---------------- sentence patterns
function sentQ(list) {
  const pool = list || DB.sentences.filter(s => UI.sKind === 'all' || s.kind === UI.sKind);
  if (!pool.length) return null;
  const s = pickItem(pool, x => x.id);
  const para = s.kind === '言い換え';
  const html = para ? esc(s.s).replace(/［(.+?)］/, '<u style="text-decoration-thickness:2px">$1</u>') : esc(s.s).replace('（　　）', '<span class="blank">（　　）</span>');
  return { id: s.id, sec: 'sent', label: s.s, tag: s.kind + (s.lv ? ' · ' + s.lv : ''), prompt: `<div class="q-jp">${html}</div>`,
    ask: para ? 'Chọn cách nói gần nghĩa nhất với phần gạch chân' : 'Chọn từ phù hợp nhất để điền vào chỗ trống',
    opts: [s.a, ...s.d], answer: 0, jpOpts: true, explain: `<div class="small">${esc(s.vi)}</div>` };
}
function renderSent(main) {
  main.innerHTML = `<h1>Mẫu câu từ vựng</h1>
  <p class="muted small">Dạng 文脈規定 (điền từ hợp ngữ cảnh) và 言い換え類義 (chọn cách nói gần nghĩa) như phần 文字・語彙 của đề N3.</p>
  <div class="toolbar">${[['all', 'Tất cả'], ['文脈規定', '文脈規定 · điền từ'], ['言い換え', '言い換え · gần nghĩa']].map(([k, n]) =>
    `<button type="button" class="chip" data-kind="${k}" aria-pressed="${UI.sKind === k}">${n}</button>`).join('')}</div>
  <div id="stage"></div>`;
  main.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { UI.sKind = b.dataset.kind; saveUI(); render(); });
  quiz($('#stage', main), () => sentQ());
}

// ---------------- reading
function renderRead(main) {
  const open = UI.view.read;
  const p = open && DB.reading.find(r => r.id === open);
  if (!p) {
    main.innerHTML = `<h1>Đọc hiểu</h1><p class="muted small">Mỗi bài: điền vào chỗ trống (dạng 文章の文法) rồi trả lời câu hỏi nội dung.</p>
      <div class="grid">${DB.reading.map(r => { const res = S.r[r.id]; return `<button type="button" class="stat" data-open="${r.id}">
        <div class="stat-head"><b>${esc(r.title)}</b><span class="stat-num">${res ? (res.best ?? 0) + '/' + (r.blanks.length + r.questions.length) : 'Chưa làm'}</span></div>
        <span class="muted small">${esc(r.type)}</span></button>`; }).join('')}</div>`;
    main.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { UI.view.read = b.dataset.open; saveUI(); render(); });
    return;
  }
  const items = [...p.blanks.map((b, i) => ({ id: p.id + '#b' + (i + 1), kind: 'blank', n: i + 1, q: 'Chỗ trống 【' + (i + 1) + '】', a: b.a, d: b.d })),
    ...p.questions.map((q, i) => ({ id: p.id + '#q' + (i + 1), kind: 'q', q: q.q, a: q.a, d: q.d }))];
  const answers = {};
  const text = esc(p.text).replace(/【(\d)】/g, (m, n) => `<span class="blank" id="bl${n}">【${n}】</span>`);
  main.innerHTML = `<div class="row"><button type="button" class="btn ghost" id="back">← Danh sách bài</button></div>
    <h1>${esc(p.title)}</h1><div class="muted small">${esc(p.type)}</div>
    <div class="card"><div class="passage">${text}</div>
    ${items.map((it, k) => `<div class="rq" data-k="${k}"><div class="${it.kind === 'q' ? 'q-jp' : ''}" style="${it.kind === 'q' ? 'font-size:17px' : 'font-weight:600'}">${esc(it.q)}</div>
      <div class="opts">${shuffle([it.a, ...it.d]).map(o => `<button type="button" class="opt jp" data-v="${esc(o)}"><span>${esc(o)}</span></button>`).join('')}</div></div>`).join('')}
    <div id="readScore"></div></div>`;
  $('#back', main).onclick = () => { UI.view.read = null; saveUI(); render(); };
  main.querySelectorAll('.rq').forEach(box => {
    const it = items[+box.dataset.k];
    box.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (it.id in answers) return;
      const ok = b.dataset.v === it.a; answers[it.id] = ok;
      box.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.dataset.v === it.a) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      record(it.id, 'read', ok, p.title + ' — ' + it.q);
      if (it.kind === 'blank') { const bl = $('#bl' + it.n, main); bl.textContent = it.a; bl.classList.add(ok ? 'ok' : 'bad'); }
      if (Object.keys(answers).length === items.length) {
        const sc = Object.values(answers).filter(Boolean).length;
        const r = S.r[p.id] || (S.r[p.id] = { c: 0, w: 0, s: 0 });
        r.best = Math.max(r.best || 0, sc); r.s = sc === items.length ? 2 : 0; save();
        $('#readScore', main).innerHTML = `<div class="score">Kết quả: ${sc}/${items.length}</div><div class="row"><button type="button" class="btn" id="again">Làm lại bài này</button></div>`;
        $('#again', main).onclick = () => render();
      }
    });
  });
}

// ---------------- mistakes
function renderMiss(main) {
  const by = {};
  Object.entries(S.m).forEach(([id, m]) => (by[m.sec] = by[m.sec] || []).push([id, m]));
  const run = UI.view.miss;
  if (run && by[run]) {
    main.innerHTML = `<div class="row"><button type="button" class="btn ghost" id="back">← Sổ lỗi sai</button></div><h1>Ôn lỗi sai · ${SEC_NAME[run]}</h1>
      <p class="muted small">Trả lời đúng 2 lần liên tiếp thì câu đó được xoá khỏi sổ.</p><div id="stage"></div>`;
    $('#back', main).onclick = () => { UI.view.miss = null; saveUI(); render(); };
    const ids = () => Object.keys(S.m).filter(id => S.m[id].sec === run);
    const gen = () => {
      const list = ids(); if (!list.length) return null;
      if (run === 'vocab') { const v = DB.vById[pick(list)]; return v ? forceVocab(v) : null; }
      if (run === 'kanji') { const k = DB.kById[pick(list)]; return k ? kanjiForce(k) : null; }
      if (run === 'grammar') return grammarQ(list.map(i => DB.gqById[i]).filter(Boolean));
      if (run === 'sent') return sentQ(list.map(i => DB.sById[i]).filter(Boolean));
      return null;
    };
    quiz($('#stage', main), gen);
    return;
  }
  const total = Object.keys(S.m).length;
  main.innerHTML = `<h1>Sổ lỗi sai</h1>
    ${total ? '' : '<div class="empty">Chưa có lỗi sai nào. Câu nào bạn trả lời sai sẽ được lưu ở đây để ôn lại.</div>'}
    ${Object.entries(by).map(([sec, list]) => `<div class="card"><div class="stat-head"><h2>${SEC_NAME[sec] || sec}</h2><span class="stat-num">${list.length} câu</span></div>
      ${sec !== 'read' ? `<div class="row"><button type="button" class="btn" data-run="${sec}">Ôn lại phần này</button></div>` : '<div class="muted small">Mở lại bài trong tab Đọc hiểu để làm lại.</div>'}
      <div class="words">${list.sort((a, b) => b[1].n - a[1].n).slice(0, 60).map(([id, m]) => `<div class="word-row"><span class="jp">${esc((m.label || id).split(' — ')[0])}</span><span class="small">${esc((m.label || '').split(' — ')[1] || '')} <span class="muted">· sai ${m.n} lần</span></span></div>`).join('')}</div></div>`).join('')}
    <div class="card"><h2>Sao lưu tiến độ (file JSON)</h2>
      <p class="muted small">Tiến độ và sổ lỗi sai lưu trong trình duyệt này. Xuất ra file để giữ lại hoặc chuyển sang máy khác.</p>
      <div class="row"><button type="button" class="btn ghost" id="exp">Xuất file JSON</button>
      <label class="btn ghost" for="imp" style="display:inline-block">Nhập file JSON</label><input type="file" id="imp" accept="application/json,.json" hidden>
      <button type="button" class="btn danger" id="clr">Xoá sổ lỗi sai</button></div><div id="msg" class="small"></div></div>`;
  main.querySelectorAll('[data-run]').forEach(b => b.onclick = () => { UI.view.miss = b.dataset.run; saveUI(); render(); });
  $('#exp', main).onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'jlpt-tien-do-' + today() + '.json'; a.click();
    $('#msg', main).textContent = 'Đã tạo file tiến độ.';
  };
  $('#imp', main).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { const d = JSON.parse(t); if (!d.r) throw 0; S = Object.assign({ r: {}, m: {}, day: {} }, d); save(); badge(); render(); })
      .catch(() => { $('#msg', main).textContent = 'File không đúng định dạng tiến độ của trang này.'; });
  };
  let armed = false;
  $('#clr', main).onclick = e => {
    if (!armed) { armed = true; e.target.textContent = 'Bấm lần nữa để xoá'; return; }
    S.m = {}; save(); badge(); render();
  };
}
function forceVocab(v) {
  const near = DB.vocab.filter(x => x.t === v.t && x.id !== v.id).map(x => x.vi);
  return { id: v.id, sec: 'vocab', label: v.w + ' — ' + v.vi, tag: DB.topicName[v.t] || '', prompt: `<div class="big-jp">${esc(v.w)}</div>${v.r ? `<div class="jp muted">${esc(v.r)}</div>` : ''}`,
    ask: 'Chọn nghĩa đúng', opts: [v.vi, ...distract(v.vi, near.concat(DB.vocab.slice(0, 500).map(x => x.vi)))], answer: 0, explain: vocabExplain(v) };
}
function kanjiForce(k) {
  return { id: k.id, sec: 'kanji', label: k.k + ' ' + k.hv, tag: 'Kanji ' + k.lv, prompt: `<div class="big-kanji">${esc(k.k)}</div>`, ask: 'Chọn âm Hán Việt',
    opts: [k.hv, ...distract(k.hv, DB.kanji.filter(x => x.lv === k.lv).map(x => x.hv))], answer: 0, explain: kanjiExplain(k) };
}

// ---------------- home
function renderHome(main) {
  const d = daysLeft();
  const sec = [
    ['vocab', 'Từ vựng', DB.vocab.map(v => v.id)],
    ['kanji', 'Kanji', DB.kanji.map(k => k.id)],
    ['grammar', 'Ngữ pháp', DB.gq.map(x => x.id)],
    ['sent', 'Mẫu câu', DB.sentences.map(s => s.id)],
    ['read', 'Đọc hiểu', DB.reading.map(r => r.id)]];
  const lvStat = (arr, lv) => { const a = arr.filter(x => x.lv === lv); return [a.filter(x => learned(x.id)).length, a.length]; };
  const t = S.day[today()] || { n: 0, ok: 0 };
  const week = Object.entries(S.day).filter(([k]) => (Date.now() - new Date(k)) / 86400000 < 7).reduce((s, [, v]) => s + v.n, 0);
  main.innerHTML = `<section class="hero"><div class="days">${d > 0 ? d : 0}<small>ngày</small></div>
    <div class="hero-text"><h1>${d > 0 ? 'đến kỳ thi JLPT N3' : d === 0 ? 'Hôm nay là ngày thi. Chúc bạn đỗ!' : 'Kỳ thi đã qua'}</h1>
    <div class="muted">Chủ nhật 06/12/2026 · Hôm nay: ${t.n} câu, đúng ${t.n ? Math.round(100 * t.ok / t.n) : 0}% · 7 ngày qua: ${week} câu</div></div></section>
  <h2>Tiến độ từng phần</h2>
  <p class="muted small">Một mục được tính là "đã thuộc" khi bạn trả lời đúng 2 lần liên tiếp.</p>
  <div class="grid">${sec.map(([k, n, ids]) => { const done = ids.filter(learned).length, pct = ids.length ? Math.round(100 * done / ids.length) : 0;
    return `<button type="button" class="stat" data-go="${k}"><div class="stat-head"><b>${n}</b><span class="stat-num">${done}/${ids.length} · ${pct}%</span></div><div class="bar${pct >= 80 ? ' ok' : ''}"><i style="width:${pct}%"></i></div></button>`; }).join('')}
    <button type="button" class="stat" data-go="miss"><div class="stat-head"><b>Lỗi sai cần ôn</b><span class="stat-num">${Object.keys(S.m).length} câu</span></div><span class="muted small">Ôn lại những câu đã trả lời sai</span></button></div>
  <h2>Theo cấp độ</h2>
  <div class="grid">${['N5', 'N4', 'N3'].map(lv => { const [a, b] = lvStat(DB.vocab, lv), [c, e] = lvStat(DB.kanji, lv);
    return `<div class="stat" style="cursor:default"><b>${lv}</b>
      <div class="small">Từ vựng ${a}/${b}</div><div class="bar"><i style="width:${b ? 100 * a / b : 0}%"></i></div>
      <div class="small">Kanji ${c}/${e}</div><div class="bar"><i style="width:${e ? 100 * c / e : 0}%"></i></div></div>`; }).join('')}</div>`;
  main.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

// ---------------- router
const VIEWS = { home: renderHome, vocab: renderVocab, kanji: renderKanji, grammar: renderGrammar, sent: renderSent, read: renderRead, miss: renderMiss };
function render() {
  KEYS = null;
  const main = $('#main');
  document.querySelectorAll('.tabs button').forEach(b => {
    b.setAttribute('aria-current', b.dataset.tab === UI.tab ? 'page' : 'false');
    if (b.dataset.tab === UI.tab) b.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
  (VIEWS[UI.tab] || renderHome)(main);
  const d = daysLeft(); $('#countChip').textContent = d > 0 ? 'Còn ' + d + ' ngày' : '';
}
function go(tab) { UI.tab = tab; if (tab === 'miss') UI.view.miss = null; saveUI(); render(); window.scrollTo(0, 0); if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab); }
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); go(b.dataset.tab); }));
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (VIEWS[t] && t !== UI.tab) go(t); });

loadData().then(() => {
  const t = location.hash.slice(1); if (VIEWS[t]) UI.tab = t;
  badge(); render();
}).catch(err => {
  $('#main').innerHTML = `<div class="empty">Không tải được dữ liệu (${esc(err.message)}). Nếu bạn mở file trực tiếp trên máy, hãy chạy <code>python3 -m http.server</code> trong thư mục này rồi mở <code>http://localhost:8000</code>.</div>`;
});
