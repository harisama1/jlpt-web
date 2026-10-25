/* Ôn JLPT N3 — flashcards and fill-in-the-blank drills over data/*.json, in rounds of 10 questions.
   Progress and the mistake book live in this browser (localStorage) and can be exported / imported as a JSON file. */
'use strict';
const EXAM = new Date(2026, 11, 6);                 // JLPT: Sunday 06/12/2026
const START = new Date(2026, 9, 12);                // first study day, for the countdown ring
const DAILY_GOAL = 40;
const ROUND = 10;
const KEY = 'jlpt-web-v1', UIKEY = 'jlpt-web-ui-v2', DECKKEY = 'jlpt-web-deck-v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const HAS_KANJI = /[一-鿿々]/;

// ---------------- icons (inline SVG, stroke = currentColor)
const P = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  vocab: '<rect x="4" y="3" width="13" height="17" rx="2"/><path d="M8 3v17"/><path d="M11 8h3M11 12h3"/><path d="M17 7h3v14H8"/>',
  kanji: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 9h10M12 6v12M8 14l-2 3M16 14l2 3"/>',
  grammar: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15l2 2 3-4"/>',
  syn: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  sent: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h3M13 10h3"/>',
  read: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>',
  miss: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  more: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  speak: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
  check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 5l-7 7 7 7"/>'
};
const icon = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const SECTIONS = [
  { id: 'home', name: 'Trang chủ', ic: 'home' },
  { id: 'vocab', name: 'Từ vựng', ic: 'vocab', sub: 'Flashcard theo chủ đề' },
  { id: 'kanji', name: 'Kanji', ic: 'kanji', sub: 'Âm Hán Việt và từ ghép' },
  { id: 'grammar', name: 'Ngữ pháp', ic: 'grammar', sub: 'Điền vào chỗ trống' },
  { id: 'syn', name: 'Đồng nghĩa', ic: 'syn', sub: 'Chọn từ gần nghĩa nhất' },
  { id: 'sent', name: 'Mẫu câu', ic: 'sent', sub: '文脈規定 · 言い換え' },
  { id: 'read', name: 'Đọc hiểu', ic: 'read', sub: 'Đoạn văn + câu hỏi' },
  { id: 'miss', name: 'Lỗi sai', ic: 'miss', sub: 'Ôn lại câu đã sai' }];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.id, s]));
const color = id => `--c: var(--c-${id})`;

// ---------------- storage
function loadJSON(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
let S = loadJSON(KEY, {});
S.r = S.r || {}; S.m = S.m || {}; S.day = S.day || {};
let UI = Object.assign({ tab: 'home', vTopic: 'all', vLv: 'all', vMode: 'mean', kLv: 'all', kMode: 'hv', gLv: 'all', gView: 'quiz',
  sKind: 'all', yPos: 'all', yLv: 'all', gTopic: 'all', read: null, miss: null, theme: 'auto', accent: 'indigo', listQ: '', picker: null }, loadJSON(UIKEY, {}));
UI.picker = null;
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
function saveUI() { try { localStorage.setItem(UIKEY, JSON.stringify(UI)); } catch (e) { } }
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function record(id, sec, ok, label) {
  const r = S.r[id] || (S.r[id] = { c: 0, w: 0, s: 0 });
  if (ok) { r.c++; r.s++; } else { r.w++; r.s = 0; S.m[id] = { sec, n: (S.m[id] ? S.m[id].n : 0) + 1, t: Date.now(), label }; }
  if (ok && S.m[id] && r.s >= 2) delete S.m[id];         // two right answers in a row clear a mistake
  const d = S.day[today()] || (S.day[today()] = { n: 0, ok: 0 }); d.n++; if (ok) d.ok++;
  save(); badges();
}
const learned = id => S.r[id] && S.r[id].s >= 2;

// ---------------- speech (Japanese text-to-speech, where the browser has it)
const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
function speak(text) {
  if (!canSpeak || !text) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/（　　）/g, '')); u.lang = 'ja-JP'; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) { }
}
const speakBtn = t => canSpeak ? `<button type="button" class="speak" data-say="${esc(t)}" aria-label="Nghe phát âm">${icon('speak')}</button>` : '';
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-say]'); if (b) { e.preventDefault(); speak(b.dataset.say); } });

// ---------------- data
const DB = {};
async function loadData() {
  const names = ['topics', 'vocab', 'kanji', 'grammar', 'sentences', 'reading', 'synonyms', 'gloss'];
  const res = await Promise.all(names.map(n => fetch('data/' + n + '.json').then(r => { if (!r.ok) throw new Error(n); return r.json(); })));
  names.forEach((n, i) => DB[n] = res[i]);
  DB.vById = Object.fromEntries(DB.vocab.map(v => [v.id, v]));
  DB.kById = Object.fromEntries(DB.kanji.map(k => [k.id, k]));
  DB.gq = []; DB.grammar.forEach(g => g.q.forEach((q, i) => DB.gq.push({ id: g.id + '.' + i, g, q })));
  DB.gqById = Object.fromEntries(DB.gq.map(x => [x.id, x]));
  DB.sById = Object.fromEntries(DB.sentences.map(s => [s.id, s]));
  DB.yById = Object.fromEntries(DB.synonyms.map(s => [s.id, s]));
  DB.topicName = Object.fromEntries(DB.topics.map(t => [t.id, t.name]));
  DB.groups = [...new Set(DB.grammar.map(g => g.grp).filter(Boolean))];
  // lookups used to explain every answer option
  DB.byW = {}; DB.byR = {}; DB.byVi = {};
  DB.vocab.forEach(v => { DB.byW[v.w] = DB.byW[v.w] || v; if (v.r) DB.byR[v.r] = DB.byR[v.r] || v; DB.byVi[v.vi] = DB.byVi[v.vi] || v; });
  DB.core = {}; DB.grammar.forEach(g => (g.cores || []).forEach(c => { if (!DB.core[c]) DB.core[c] = g; }));
  DB.hv = {}; DB.kanji.forEach(k => (DB.hv[k.hv] = DB.hv[k.hv] || []).push(k.k));
  DB.kw = {}; DB.kanji.forEach(k => k.words.forEach(w => { if (!DB.kw[w.w]) DB.kw[w.w] = w; }));
}
// Vietnamese meaning of an answer option (word, reading, grammar fragment)
function meanOf(o) {
  const v = DB.byW[o] || DB.byR[o];
  if (v) return (v.r && v.r !== o ? v.w + '【' + v.r + '】' : v.w !== o ? v.w : '') + (v.w !== o || v.r && v.r !== o ? ': ' : '') + v.vi;
  const w = DB.kw[o]; if (w && w.vi) return (w.r ? '【' + w.r + '】 ' : '') + w.vi;
  if (DB.gloss[o]) return DB.gloss[o];
  const g = DB.core[o]; if (g) return 'mẫu ' + g.p + ': ' + g.mean;
  return '';
}
function daysLeft() { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((EXAM - t) / 86400000); }

// ---------------- picking and distractors
// Each scope (section + filters) has a deck: every item is asked once before any repeats. A new pass puts mistakes first,
// then unseen items, then the rest, and pushes the most recent questions to the end so a reshuffle never repeats them.
let DECK = loadJSON(DECKKEY, {});
function saveDeck() { try { localStorage.setItem(DECKKEY, JSON.stringify(DECK)); } catch (e) { } }
function pickItem(pool, idOf, scope) {
  const ids = pool.map(idOf), has = new Set(ids);
  let d = DECK[scope];
  if (!d || d.n !== ids.length) d = DECK[scope] = { n: ids.length, q: [], recent: [] };
  d.q = d.q.filter(id => has.has(id));
  if (!d.q.length) {
    const rec = new Set(d.recent);
    const groups = [ids.filter(id => S.m[id]), ids.filter(id => !S.m[id] && !S.r[id]), ids.filter(id => !S.m[id] && S.r[id])].map(shuffle).flat();
    d.q = groups.filter(id => !rec.has(id)).concat(groups.filter(id => rec.has(id)));
  }
  const id = d.q.shift();
  d.recent = [id, ...d.recent.filter(x => x !== id)].slice(0, Math.min(40, Math.floor(ids.length / 2)));
  saveDeck();
  return pool[ids.indexOf(id)];
}
function distract(answer, pool, n = 3) {
  const out = [], seen = new Set([answer]);
  for (const x of shuffle(pool)) { if (x && !seen.has(x)) { seen.add(x); out.push(x); if (out.length === n) break; } }
  return out;
}
const lvTag = lv => lv ? `<span class="lv">${esc(lv)}</span>` : '';

// ---------------- question builders: {id, sec, label, tag, prompt, ask, opts, answer, jp, say, vi, notes, why, info}
// notes[i] explains option i; vi is the translation of the sentence; why says why the answer is right.
function vocabPool() { return DB.vocab.filter(v => (UI.vTopic === 'all' || v.t === UI.vTopic) && (UI.vLv === 'all' || v.lv === UI.vLv)); }
function vocabInfo(v) {
  return `<div class="jp-line">${esc(v.w)}${v.r ? '【' + esc(v.r) + '】' : ''}${lvTag(v.lv)}${speakBtn(v.r || v.w)}</div><div>${esc(v.vi)}</div>
    ${v.ex ? `<div class="jp small muted">${esc(v.ex)}</div>` : ''}<div class="small muted">Chủ đề: ${esc(DB.topicName[v.t] || v.t)}</div>`;
}
const wordWithReading = v => v.w + (v.r && v.r !== v.w ? '【' + v.r + '】' : '');
function vocabQ(mode = UI.vMode, pool = vocabPool(), scope = 'v|' + UI.vTopic + '|' + UI.vLv + '|' + mode) {
  if (mode === 'read') pool = pool.filter(v => HAS_KANJI.test(v.w) && v.r);
  if (!pool.length) return null;
  const v = pickItem(pool, x => x.id, scope);
  // never offer another reading / meaning of the same word, or a synonym, as a wrong answer
  const fair = x => x.id !== v.id && x.w !== v.w && x.vi !== v.vi && (!v.r || x.r !== v.r);
  const near = DB.vocab.filter(x => x.t === v.t && fair(x));
  const lvPool = shuffle(DB.vocab.filter(x => x.lv === v.lv && fair(x)));
  let items, opts, notes, prompt, ask, jp = false, why;
  const take = (key, src) => { const seen = new Set([v[key]]), out = [];
    for (const x of src) if (x[key] && !seen.has(x[key])) { seen.add(x[key]); out.push(x); if (out.length === 3) break; }
    return out; };
  if (mode === 'mean') {
    items = [v, ...take('vi', shuffle(near).concat(lvPool.slice(0, 400)))];
    opts = items.map(x => x.vi); notes = items.map(x => 'là nghĩa của ' + wordWithReading(x));
    prompt = `<div class="word">${esc(v.w)}</div>${v.r && HAS_KANJI.test(v.w) ? `<div class="reading">${esc(v.r)}</div>` : ''}`;
    ask = 'Từ này nghĩa là gì?'; why = `${wordWithReading(v)} nghĩa là "${v.vi}".`;
  } else if (mode === 'read') {
    let same = lvPool.filter(x => x.r && HAS_KANJI.test(x.w) && Math.abs(x.r.length - v.r.length) <= 1);
    if (new Set(same.map(x => x.r)).size < 6) same = same.concat(lvPool.filter(x => x.r));
    items = [v, ...take('r', same)]; opts = items.map(x => x.r); jp = true;
    notes = items.map(x => 'là cách đọc của ' + x.w + ' (' + x.vi + ')');
    prompt = `<div class="word">${esc(v.w)}</div>`; ask = 'Chọn cách đọc đúng'; why = `${v.w} đọc là ${v.r}, nghĩa là "${v.vi}".`;
  } else {
    items = [v, ...take('w', shuffle(near).concat(lvPool.slice(0, 300)))]; opts = items.map(x => x.w); jp = true;
    notes = items.map(x => (x.r && x.r !== x.w ? '【' + x.r + '】 ' : '') + x.vi);
    prompt = `<div class="meaning">${esc(v.vi)}</div>`; ask = 'Chọn từ tiếng Nhật đúng'; why = `"${v.vi}" là ${wordWithReading(v)}.`;
  }
  if (opts.length < 4) return null;
  return { id: v.id, sec: 'vocab', label: v.w + ' — ' + v.vi, tag: (DB.topicName[v.t] || '') + ' · ' + v.lv, prompt, ask, opts, answer: 0, jp,
    say: mode === 'rev' ? '' : (v.r || v.w), notes, why, info: vocabInfo(v) };
}
function kanjiPool() { return DB.kanji.filter(k => UI.kLv === 'all' || k.lv === UI.kLv); }
function kanjiInfo(k) {
  return `<div class="kanji-head"><span class="kanji">${esc(k.k)}</span><div><div><b>${esc(k.hv)}</b>${lvTag(k.lv)}</div>
    <div class="small">Âm On: <span class="jp">${esc(k.on || '—')}</span></div><div class="small">Âm Kun: <span class="jp">${esc(k.kun || '—')}</span></div></div></div>
    ${k.story ? `<div class="story small">${esc(k.story)}</div>` : ''}
    <div class="words">${k.words.map(w => `<div class="wrow"><span class="jp">${esc(w.w)}</span><span><span class="jp muted">${esc(w.r)}</span>${w.vi ? ' · ' + esc(w.vi) : ''}${lvTag(w.lv)}</span></div>`).join('')}</div>`;
}
function kanjiQ(mode = UI.kMode, pool = kanjiPool(), scope = 'k|' + UI.kLv + '|' + mode, tries = 0) {
  if (!pool.length) return null;
  const k = pickItem(pool, x => x.id, scope), tag = 'Kanji ' + k.lv;
  if (mode === 'hv') {
    const opts = [k.hv, ...distract(k.hv, DB.kanji.filter(x => x.lv === k.lv && x.hv !== k.hv).map(x => x.hv))];
    return { id: k.id, sec: 'kanji', label: k.k + ' — ' + k.hv, tag, prompt: `<div class="kanji">${esc(k.k)}</div>`, ask: 'Âm Hán Việt của chữ này là gì?', opts, answer: 0,
      notes: opts.map(o => 'âm Hán Việt của ' + (DB.hv[o] || []).slice(0, 4).join('、')), why: `${k.k} đọc Hán Việt là ${k.hv}. Âm On: ${k.on || '—'}, âm Kun: ${k.kun || '—'}.`, info: kanjiInfo(k) };
  }
  const words = k.words.filter(w => w.r && w.vi && HAS_KANJI.test(w.w) && !w.w.includes('・'));
  if (!words.length) return tries < 20 ? kanjiQ(mode, pool, scope, tries + 1) : null;
  const w = pick(words);
  const others = shuffle(DB.kanji.filter(x => x.lv === k.lv && x.id !== k.id).flatMap(x => x.words).filter(x => x.w !== w.w && x.vi !== w.vi && x.r !== w.r));
  const hl = esc(w.w).split(esc(k.k)).join(`<span style="color:var(--c)">${esc(k.k)}</span>`);
  const take = (key, src) => { const seen = new Set([w[key]]), out = [];
    for (const x of src) if (x[key] && !seen.has(x[key])) { seen.add(x[key]); out.push(x); if (out.length === 3) break; }
    return out; };
  const why = `${w.w} đọc là ${w.r}, nghĩa là "${w.vi}" (chữ ${k.k} – ${k.hv}).`;
  if (mode === 'wread') {
    let same = others.filter(x => x.r && Math.abs(x.r.length - w.r.length) <= 1);
    if (new Set(same.map(x => x.r)).size < 6) same = same.concat(others.filter(x => x.r));
    const items = [w, ...take('r', same)];
    return { id: k.id, sec: 'kanji', label: w.w + ' (' + k.k + ')', tag, prompt: `<div class="word">${hl}</div>`, ask: 'Chọn cách đọc của từ ghép',
      opts: items.map(x => x.r), notes: items.map(x => 'là cách đọc của ' + x.w + (x.vi ? ' (' + x.vi + ')' : '')), why, answer: 0, jp: true, say: w.r, info: kanjiInfo(k) };
  }
  const items = [w, ...take('vi', others)];
  return { id: k.id, sec: 'kanji', label: w.w + ' (' + k.k + ')', tag, prompt: `<div class="word">${hl}</div><div class="reading">${esc(w.r)}</div>`, ask: 'Từ ghép này nghĩa là gì?',
    opts: items.map(x => x.vi), notes: items.map(x => 'là nghĩa của ' + x.w + '【' + x.r + '】'), why, answer: 0, say: w.r, info: kanjiInfo(k) };
}
function grammarInfo(g) {
  return `<div class="jp-line"><b>${esc(g.p)}</b>${lvTag(g.lv)}</div><div>${esc(g.mean)}</div>
    ${g.struct ? `<div class="small muted">Cấu trúc: <span class="jp">${esc(g.struct)}</span></div>` : ''}
    ${g.ex.slice(0, 2).map(e => `<div class="jp small">${esc(e.jp)} ${speakBtn(e.jp)}</div>${e.vi ? `<div class="small muted">${esc(e.vi)}</div>` : ''}`).join('')}`;
}
const blankHTML = s => esc(s).replace('（　　）', '<span class="blank">（　　）</span>');
const gPool = () => DB.gq.filter(x => (UI.gLv === 'all' || x.g.lv === UI.gLv) && (UI.gTopic === 'all' || x.g.grp === UI.gTopic));
function grammarQ(pool = gPool(), scope = 'g|' + UI.gLv + '|' + UI.gTopic) {
  if (!pool.length) return null;
  const x = pickItem(pool, y => y.id, scope), opts = [x.q.a, ...x.q.d];
  return { id: x.id, sec: 'grammar', label: x.g.p, tag: 'Ngữ pháp ' + x.g.lv + (x.g.grp ? ' · ' + x.g.grp : ''),
    prompt: `<div class="sentence">${blankHTML(x.q.s)}</div>`, ask: 'Chọn mẫu điền vào chỗ trống', opts, answer: 0, jp: true,
    say: x.q.s.replace('（　　）', x.q.a), sayAfter: true, vi: x.q.vi, full: x.q.s.replace('（　　）', x.q.a),
    notes: opts.map((o, i) => i ? meanOf(o) : 'mẫu ' + x.g.p + ': ' + x.g.mean),
    why: `Câu cần ý "${x.g.mean}", nên dùng mẫu ${x.g.p}.`, info: grammarInfo(x.g) };
}
function sentQ(pool = DB.sentences.filter(s => UI.sKind === 'all' || s.kind === UI.sKind), scope = 's|' + UI.sKind) {
  if (!pool.length) return null;
  const s = pickItem(pool, x => x.id, scope), para = s.kind === '言い換え', opts = [s.a, ...s.d];
  const html = para ? esc(s.s).replace(/［(.+?)］/, '<u class="mark">$1</u>') : blankHTML(s.s);
  const marked = para ? (s.s.match(/［(.+?)］/) || [, ''])[1] : '';
  return { id: s.id, sec: 'sent', label: s.s, tag: s.kind + (s.lv ? ' · ' + s.lv : ''), prompt: `<div class="sentence">${html}</div>`,
    ask: para ? 'Chọn cách nói gần nghĩa nhất với phần gạch chân' : 'Chọn từ phù hợp nhất để điền vào chỗ trống',
    opts, answer: 0, jp: true, say: para ? s.s.replace(/［|］/g, '') : s.s.replace('（　　）', s.a), sayAfter: true,
    vi: s.vi, full: para ? s.s.replace(/［|］/g, '') : s.s.replace('（　　）', s.a), notes: opts.map(meanOf),
    why: para ? `「${marked}」${meanOf(marked) ? ' (' + meanOf(marked) + ')' : ''} gần nghĩa nhất với 「${s.a}」.` : `Chỉ 「${s.a}」 hợp với nghĩa của cả câu.` };
}
const POS = { all: 'Tất cả', n: 'Danh từ', v: 'Động từ', a: 'Tính từ', d: 'Phó từ · từ nối' };
function synQ(pool = DB.synonyms.filter(y => (UI.yPos === 'all' || y.pos === UI.yPos) && (UI.yLv === 'all' || y.lv === UI.yLv)), scope = 'y|' + UI.yPos + '|' + UI.yLv) {
  if (!pool.length) return null;
  const y = pickItem(pool, x => x.id, scope), opts = [y.a, ...y.d];
  return { id: y.id, sec: 'syn', label: y.w + ' — ' + y.a, tag: POS[y.pos] + ' · ' + y.lv,
    prompt: `<div class="word">${esc(y.w)}</div>${y.r ? `<div class="reading">${esc(y.r)}</div>` : ''}`,
    ask: 'Từ nào gần nghĩa nhất với từ này?', opts, answer: 0, jp: true, say: y.r || y.w,
    notes: opts.map(meanOf), why: `${y.w}${y.r ? '【' + y.r + '】' : ''} nghĩa là "${y.vi}", cùng nghĩa với ${y.a}.`,
    info: `<div class="jp-line">${esc(y.w)} ≈ ${esc(y.a)}${lvTag(y.lv)}</div><div>Nghĩa: ${esc(y.vi)}</div>` };
}
function mixQ() {
  const g = pick([() => vocabQ('mean', DB.vocab, 'mix|v'), () => vocabQ('read', DB.vocab, 'mix|vr'), () => kanjiQ('hv', DB.kanji, 'mix|k'), () => kanjiQ('word', DB.kanji, 'mix|kw'),
    () => grammarQ(DB.gq, 'mix|g'), () => synQ(DB.synonyms, 'mix|y'), () => sentQ(DB.sentences, 'mix|s')]);
  return g();
}

// ---------------- explanation shown after every answer: translation, why the answer fits, what each option means
function explainHTML(q, chosen, order = q.opts.map((o, i) => i)) {
  // same order and numbers as the answer buttons
  const rows = order.map((i, k) => { const o = q.opts[i];
    const cls = i === q.answer ? 'right' : i === chosen ? 'wrong' : '';
    const mark = i === q.answer ? '<span class="xm ok">Đáp án đúng</span>' : i === chosen ? '<span class="xm bad">Bạn chọn</span>' : '';
    const note = q.notes && q.notes[i] ? esc(q.notes[i]) : '<span class="muted">—</span>';
    return `<li class="${cls}"><span class="xo${q.jp ? ' jp' : ''}"><span class="xk">${k + 1}</span>${esc(o)}</span><span class="xn">${note}</span>${mark}</li>`;
  }).join('');
  return `<div class="explain">
    ${q.full || q.vi ? `<div class="xsec"><div class="xt">Dịch nghĩa</div>${q.full ? `<div class="jp">${esc(q.full)} ${speakBtn(q.full)}</div>` : ''}${q.vi ? `<div>${esc(q.vi)}</div>` : ''}</div>` : ''}
    <div class="xsec"><div class="xt">Giải thích</div>${q.why ? `<div>${esc(q.why)}</div>` : ''}<ul class="xlist">${rows}</ul></div>
    ${q.info ? `<details class="xsec more"><summary>Xem thêm về ${q.sec === 'grammar' ? 'mẫu ngữ pháp' : q.sec === 'kanji' ? 'chữ Kanji' : 'từ này'}</summary><div class="info">${q.info}</div></details>` : ''}
  </div>`;
}

// ---------------- round of 10: progress, feedback, result
let KEYS = null;
document.addEventListener('keydown', e => { if (KEYS) KEYS(e); });
function round(el, sec, gen, opts = {}) {
  const st = { i: 0, ok: 0, wrong: [] };
  const size = opts.size || ROUND;
  const next = () => { st.i < size ? ask() : result(); };
  function ask() {
    const q = gen();
    if (!q) { el.innerHTML = '<div class="empty">Không có câu hỏi phù hợp với lựa chọn này. Hãy chọn phạm vi khác.</div>'; KEYS = null; return; }
    const order = shuffle(q.opts.map((t, i) => i));
    el.innerHTML = `<div class="card qcard" style="${color(q.sec)}">
      <div class="qhead"><span class="tag">${esc(q.tag || '')}</span><span>Câu ${st.i + 1}/${size}</span></div>
      <div class="prog"><i style="width:${100 * st.i / size}%"></i></div>
      <div class="prompt">${q.prompt}${q.say && !q.sayAfter ? speakBtn(q.say) : ''}<div class="ask">${esc(q.ask)}</div></div>
      <div class="opts">${order.map((i, k) => `<button type="button" class="opt${q.jp ? ' jp' : ''}" data-i="${i}"><span class="k">${k + 1}</span><span>${esc(q.opts[i])}</span></button>`).join('')}</div>
      <div class="next-row" hidden><button type="button" class="btn c next">${st.i + 1 < size ? 'Câu tiếp' : 'Xem kết quả'}</button><span class="hint">Phím 1–4 để chọn, Enter để qua câu</span></div>
      <div class="fb" hidden></div>
    </div>`;
    const card = $('.qcard', el), btns = $$('.opt', card);
    let done = false;
    const choose = b => {
      if (done) return; done = true;
      const i = +b.dataset.i, ok = i === q.answer;
      btns.forEach(x => { x.disabled = true; if (+x.dataset.i === q.answer) x.classList.add('right'); else if (x !== b) x.classList.add('dim'); });
      if (!ok) b.classList.add('wrong');
      st.i++; if (ok) st.ok++; else st.wrong.push({ label: q.label, a: q.opts[q.answer] });
      record(q.id, q.sec, ok, q.label);
      const fb = $('.fb', card); fb.hidden = false; fb.className = 'fb feedback ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = `<div class="verdict">${icon(ok ? 'check' : 'x')}${ok ? 'Chính xác!' : 'Chưa đúng. Đáp án: ' + esc(q.opts[q.answer])}</div>` + explainHTML(q, i, order);
      $('.prog i', card).style.width = (100 * st.i / size) + '%';
      $('.next-row', card).hidden = false; $('.next', card).focus({ preventScroll: true });
    };
    btns.forEach(b => b.addEventListener('click', () => choose(b)));
    $('.next', card).addEventListener('click', next);
    KEYS = e => {
      if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;
      if (!done && /^[1-4]$/.test(e.key) && btns[+e.key - 1]) { choose(btns[+e.key - 1]); e.preventDefault(); }
      else if (done && (e.key === 'Enter' || e.key === ' ')) { next(); e.preventDefault(); }
    };
  }
  function result() {
    KEYS = null;
    const pct = Math.round(100 * st.ok / size);
    const msg = pct === 100 ? 'Tuyệt vời, không sai câu nào!' : pct >= 80 ? 'Rất tốt! Ôn lại vài câu sai là ổn.' : pct >= 50 ? 'Khá rồi, cố thêm chút nữa.' : 'Đừng nản, các câu sai đã được lưu để ôn lại.';
    el.innerHTML = `<div class="card result" style="${color(sec)}"><div class="muted small">Kết quả lượt này</div><div class="score">${st.ok}/${size}</div><div><b>${msg}</b></div>
      ${st.wrong.length ? `<ul>${st.wrong.map(w => `<li><span class="jp">${esc(w.label)}</span><br><span class="small muted">Đáp án: </span><span class="jp">${esc(w.a)}</span></li>`).join('')}</ul>` : ''}
      <div class="row"><button type="button" class="btn c again">Lượt mới</button>${st.wrong.length && sec !== 'miss' ? `<button type="button" class="btn sec tomiss">Ôn lỗi sai</button>` : ''}</div></div>`;
    $('.again', el).onclick = () => round(el, sec, gen, opts);
    const tm = $('.tomiss', el); if (tm) tm.onclick = () => go('miss');
    $('.again', el).focus({ preventScroll: true });
  }
  ask();
}

// ---------------- page helpers
const pageHead = (id, title, sub) => `<div class="page-head" style="${color(id)}"><span class="badge-ic">${icon(SEC[id] ? SEC[id].ic : 'more')}</span><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
const seg = (key, items, cur) => `<div class="seg">${items.map(([v, n]) => `<button type="button" data-k="${key}" data-v="${esc(v)}" aria-pressed="${cur === v}">${esc(n)}</button>`).join('')}</div>`;
const LVS = [['all', 'Mọi cấp'], ['N5', 'N5'], ['N4', 'N4'], ['N3', 'N3']];
function bindSeg(root) {
  $$('[data-k]', root).forEach(b => b.onclick = () => { UI[b.dataset.k] = b.dataset.v; saveUI(); render(); });
}
// filters: always open on a wide screen; on a phone folded into a one-line summary so the question is visible at once
const WIDE = matchMedia('(min-width: 1000px)');
function drillPage(main, id, title, sub, filtersHTML, run, summary, bar = '') {
  const open = WIDE.matches || UI.fOpen;
  main.innerHTML = pageHead(id, title, sub) + bar + `<div class="drill" style="${color(id)}"><details class="filters card" ${open ? 'open' : ''}>
    <summary><span class="flabel">Tuỳ chọn</span><span class="fsum">${esc(summary || '')}</span><span class="fchev" aria-hidden="true">▾</span></summary>
    <div class="fbody">${filtersHTML}</div></details><div class="stage"></div></div>`;
  const d = $('details.filters', main);
  d.addEventListener('toggle', () => { if (!WIDE.matches) { UI.fOpen = d.open; saveUI(); } });
  bindSeg(main);
  run($('.stage', main));
}
const segName = (items, v) => (items.find(x => x[0] === v) || ['', ''])[1];
function listSearch(root, rows, render) {
  const box = document.createElement('div');
  box.innerHTML = `<label class="field"><span class="flabel">Tìm kiếm</span><input type="search" id="listq" placeholder="Gõ chữ Nhật, cách đọc hoặc nghĩa…" value="${esc(UI.listQ)}"></label><div class="card wl" style="margin-top:12px"></div>`;
  root.appendChild(box);
  const out = $('.wl', box), input = $('#listq', box);
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const hit = q ? rows.filter(r => r.text.toLowerCase().includes(q)) : rows;
    out.innerHTML = hit.length ? `<div class="wlist">${hit.slice(0, 400).map(r => r.html).join('')}</div>${hit.length > 400 ? `<p class="small muted">Hiện 400 / ${hit.length} mục. Gõ thêm để lọc.</p>` : ''}` : '<p class="muted">Không tìm thấy.</p>';
  };
  input.oninput = () => { UI.listQ = input.value; saveUI(); draw(); };
  draw();
}

// ---------------- topic picker: a page of topic cards with progress; the current topic stays visible above the quiz
function topicBar(id, name, done, total) {
  const pct = total ? Math.round(100 * done / total) : 0;
  return `<div class="card topicbar" style="${color(id)}"><div class="tb-text"><span class="flabel">Chủ đề đang học</span><b>${esc(name)}</b>
    <div class="bar"><i style="width:${pct}%"></i></div><span class="small muted">Đã thuộc ${done}/${total}</span></div>
    <button type="button" class="btn c" id="pickTopic">Đổi chủ đề</button></div>`;
}
function topicPicker(main, id, title, groups, cur, onPick) {
  const card = t => { const pct = t.total ? Math.round(100 * t.done / t.total) : 0;
    return `<button type="button" class="tcard${t.id === cur ? ' on' : ''}" data-topic="${esc(t.id)}" data-text="${esc((t.name + ' ' + (t.hint || '')).toLowerCase())}">
      <b>${esc(t.name)}</b><span class="small muted">${t.total} câu · đã thuộc ${t.done}</span><div class="bar"><i style="width:${pct}%"></i></div></button>`; };
  main.innerHTML = pageHead(id, title, 'Chọn một chủ đề để ôn. Có thể đổi bất cứ lúc nào.') + `<div style="${color(id)}">
    <div class="row"><input type="search" class="tsearch" placeholder="Tìm chủ đề…" aria-label="Tìm chủ đề">${cur ? '<button type="button" class="btn sec" id="tback">Giữ chủ đề hiện tại</button>' : ''}</div>
    ${groups.map(g => `<section class="tgroup"><h2>${esc(g.name)}</h2><div class="tgrid">${g.items.map(card).join('')}</div></section>`).join('')}</div>`;
  $$('[data-topic]', main).forEach(b => b.onclick = () => { UI.picker = null; onPick(b.dataset.topic); saveUI(); render(); window.scrollTo(0, 0); });
  const back = $('#tback', main); if (back) back.onclick = () => { UI.picker = null; render(); };
  $('.tsearch', main).oninput = e => { const q = e.target.value.trim().toLowerCase();
    $$('[data-topic]', main).forEach(b => b.hidden = q && !b.dataset.text.includes(q));
    $$('.tgroup', main).forEach(g => g.hidden = !$$('[data-topic]', g).some(b => !b.hidden)); };
}
function vocabTopics() {
  const cnt = {}, done = {};
  DB.vocab.forEach(v => { if (UI.vLv !== 'all' && v.lv !== UI.vLv) return; cnt[v.t] = (cnt[v.t] || 0) + 1; if (learned(v.id)) done[v.t] = (done[v.t] || 0) + 1; });
  const all = { id: 'all', name: 'Tất cả chủ đề', total: Object.values(cnt).reduce((a, b) => a + b, 0), done: Object.values(done).reduce((a, b) => a + b, 0) };
  const groups = [{ name: 'Tổng hợp', items: [all] }];
  DB.topics.forEach(t => { if (!cnt[t.id]) return; let g = groups.find(x => x.name === t.group); if (!g) groups.push(g = { name: t.group, items: [] });
    g.items.push({ id: t.id, name: t.name, total: cnt[t.id], done: done[t.id] || 0 }); });
  return groups;
}
function grammarTopics() {
  const items = DB.groups.map(name => { const qs = DB.gq.filter(x => x.g.grp === name && (UI.gLv === 'all' || x.g.lv === UI.gLv));
    return { id: name, name, total: qs.length, done: qs.filter(x => learned(x.id)).length, hint: [...new Set(qs.map(x => x.g.p))].join(' ') }; }).filter(t => t.total);
  const qs = DB.gq.filter(x => UI.gLv === 'all' || x.g.lv === UI.gLv);
  return [{ name: 'Tổng hợp', items: [{ id: 'all', name: 'Tất cả mẫu ngữ pháp', total: qs.length, done: qs.filter(x => learned(x.id)).length }] },
          { name: 'Theo nhóm ngữ pháp', items }];
}
const findTopic = (groups, id) => groups.flatMap(g => g.items).find(t => t.id === id);

// ---------------- pages
function renderVocab(main) {
  const groups = vocabTopics();
  if (UI.picker === 'vocab' || !UI.vPicked) return topicPicker(main, 'vocab', 'Chọn chủ đề từ vựng', groups, UI.vPicked ? UI.vTopic : null, t => { UI.vTopic = t; UI.vPicked = true; });
  const cur = findTopic(groups, UI.vTopic) || groups[0].items[0];
  const VM = [['mean', 'Từ → nghĩa'], ['read', 'Kanji → cách đọc'], ['rev', 'Nghĩa → từ'], ['list', 'Danh sách']];
  const filters = `<div><div class="flabel">Cấp độ</div>${seg('vLv', LVS, UI.vLv)}</div><div><div class="flabel">Kiểu ôn</div>${seg('vMode', VM, UI.vMode)}</div>`;
  drillPage(main, 'vocab', 'Từ vựng', 'Mỗi lượt 10 câu, không lặp lại cho tới khi hết chủ đề', filters, st => {
    $('#pickTopic', main).onclick = () => { UI.picker = 'vocab'; render(); window.scrollTo(0, 0); };
    if (UI.vMode === 'list') listSearch(st, vocabPool().map(v => ({ text: v.w + ' ' + v.r + ' ' + v.vi,
      html: `<div class="wrow"><span class="jp">${esc(v.w)}${learned(v.id) ? '<span class="ok-mark">✓</span>' : ''}</span><span>${v.r ? `<span class="jp muted">${esc(v.r)}</span> · ` : ''}${esc(v.vi)}${lvTag(v.lv)}</span></div>` })));
    else round(st, 'vocab', () => vocabQ());
  }, segName(LVS, UI.vLv) + ' · ' + segName(VM, UI.vMode), topicBar('vocab', cur.name, cur.done, cur.total));
}
function renderKanji(main) {
  const filters = `<div><div class="flabel">Cấp độ</div>${seg('kLv', LVS, UI.kLv)}</div>
    <div><div class="flabel">Kiểu ôn</div>${seg('kMode', [['hv', 'Chữ → Hán Việt'], ['word', 'Từ ghép → nghĩa'], ['wread', 'Từ ghép → cách đọc'], ['list', 'Danh sách']], UI.kMode)}</div>
    <p class="small muted" style="margin:0">Mỗi chữ kèm các từ ghép lấy từ kho từ vựng N5–N3.</p>`;
  const KM = [['hv', 'Chữ → Hán Việt'], ['word', 'Từ ghép → nghĩa'], ['wread', 'Từ ghép → cách đọc'], ['list', 'Danh sách']];
  drillPage(main, 'kanji', 'Kanji', `${DB.kanji.length} chữ N5–N3, âm Hán Việt và từ ghép`, filters, st => {
    if (UI.kMode === 'list') listSearch(st, kanjiPool().map(k => ({ text: k.k + ' ' + k.hv + ' ' + k.on + ' ' + k.kun + ' ' + k.words.map(w => w.w + w.vi).join(' '),
      html: `<details class="wrow"><summary><span class="jp" style="font-size:24px">${esc(k.k)}</span><b>${esc(k.hv)}</b>${lvTag(k.lv)}${learned(k.id) ? '<span class="ok-mark">✓</span>' : ''}<span class="small muted jp">${k.words.slice(0, 4).map(w => esc(w.w)).join('、')}</span></summary>${kanjiInfo(k)}</details>` })));
    else round(st, 'kanji', () => kanjiQ());
  }, segName(LVS, UI.kLv) + ' · ' + segName(KM, UI.kMode));
}
function renderGrammar(main) {
  const groups = grammarTopics();
  if (UI.picker === 'grammar' || !UI.gPicked) return topicPicker(main, 'grammar', 'Chọn nhóm ngữ pháp', groups, UI.gPicked ? UI.gTopic : null, t => { UI.gTopic = t; UI.gPicked = true; });
  const cur = findTopic(groups, UI.gTopic) || groups[0].items[0];
  const filters = `<div><div class="flabel">Cấp độ</div>${seg('gLv', LVS, UI.gLv)}</div>
    <div><div class="flabel">Kiểu ôn</div>${seg('gView', [['quiz', 'Điền chỗ trống'], ['list', 'Danh sách mẫu']], UI.gView)}</div>`;
  drillPage(main, 'grammar', 'Ngữ pháp', 'Điền vào chỗ trống, có dịch câu và giải thích từng đáp án', filters, st => {
    $('#pickTopic', main).onclick = () => { UI.picker = 'grammar'; render(); window.scrollTo(0, 0); };
    if (UI.gView === 'list') listSearch(st, DB.grammar.filter(g => (UI.gLv === 'all' || g.lv === UI.gLv) && (UI.gTopic === 'all' || g.grp === UI.gTopic)).map(g => ({ text: g.p + ' ' + g.mean,
      html: `<details class="wrow"><summary><span class="jp"><b>${esc(g.p)}</b></span>${lvTag(g.lv)}<span class="small muted">${esc(g.mean.slice(0, 80))}</span></summary><div class="info">${grammarInfo(g)}</div></details>` })));
    else round(st, 'grammar', () => grammarQ());
  }, segName(LVS, UI.gLv) + ' · ' + (UI.gView === 'list' ? 'Danh sách mẫu' : 'Điền chỗ trống'), topicBar('grammar', cur.name, cur.done, cur.total));
}
function renderSyn(main) {
  const filters = `<div><div class="flabel">Từ loại</div>${seg('yPos', Object.entries(POS), UI.yPos)}</div>
    <div><div class="flabel">Cấp độ</div>${seg('yLv', LVS, UI.yLv)}</div>
    <p class="small muted" style="margin:0">Dạng 言い換え類義 của đề N3: tìm từ hoặc cách nói có nghĩa gần nhất trong 4 đáp án.</p>`;
  drillPage(main, 'syn', 'Đồng nghĩa', `${DB.synonyms.length} cặp từ đồng nghĩa hay gặp`, filters, st => round(st, 'syn', () => synQ()), POS[UI.yPos] + ' · ' + segName(LVS, UI.yLv));
}
function renderSent(main) {
  const filters = `<div><div class="flabel">Dạng bài</div>${seg('sKind', [['all', 'Tất cả'], ['文脈規定', '文脈規定 · điền từ'], ['言い換え', '言い換え · gần nghĩa']], UI.sKind)}</div>
    <p class="small muted" style="margin:0">Như phần 文字・語彙 của đề N3.</p>`;
  drillPage(main, 'sent', 'Mẫu câu', `${DB.sentences.length} câu điền từ và chọn cách nói gần nghĩa`, filters, st => round(st, 'sent', () => sentQ()), UI.sKind === 'all' ? 'Tất cả dạng bài' : UI.sKind);
}
function renderRead(main) {
  const p = UI.read && DB.reading.find(r => r.id === UI.read);
  if (!p) {
    main.innerHTML = pageHead('read', 'Đọc hiểu', 'Điền chỗ trống kiểu 文章の文法 rồi trả lời câu hỏi nội dung') +
      `<div class="rlist" style="${color('read')}">${DB.reading.map(r => { const res = S.r[r.id], tot = r.blanks.length + r.questions.length;
        return `<button type="button" class="tile" data-open="${r.id}"><span class="chipnum">${res ? 'Đúng ' + (res.best ?? 0) + '/' + tot : 'Chưa làm'}</span><b>${esc(r.title)}</b><span class="sub">${esc(r.type)} · ${tot} câu</span></button>`; }).join('')}</div>`;
    $$('[data-open]', main).forEach(b => b.onclick = () => { UI.read = b.dataset.open; saveUI(); render(); window.scrollTo(0, 0); });
    return;
  }
  const items = [...p.blanks.map((b, i) => ({ id: p.id + '#b' + (i + 1), kind: 'blank', n: i + 1, q: 'Chỗ trống 【' + (i + 1) + '】', a: b.a, d: b.d })),
    ...p.questions.map((q, i) => ({ id: p.id + '#q' + (i + 1), kind: 'q', q: q.q, a: q.a, d: q.d, vi: q.vi, avi: q.avi, dvi: q.dvi, why: q.why }))];
  p.blanks.forEach((b, i) => { items[i].why = b.why; });
  const answers = {};
  const text = esc(p.text).replace(/【(\d)】/g, (m, n) => `<span class="blank" id="bl${n}">【${n}】</span>`);
  main.innerHTML = `<div class="row"><button type="button" class="btn sec" id="back">${icon('back')} Danh sách bài</button></div>` + pageHead('read', p.title, p.type) +
    `<div class="rgrid" style="${color('read')}"><div class="card passage">${text}<div style="margin-top:10px">${speakBtn(p.text.replace(/【\d】/g, '…'))}</div>
    ${p.vi ? `<details class="xsec more" style="margin-top:12px"><summary>Xem bản dịch đoạn văn</summary><div class="rvi">${esc(p.vi).replace(/\n/g, '<br>')}</div></details>` : ''}</div><div class="rqs">
    ${items.map((it, k) => `<div class="card rq" data-k="${k}"><div class="rq-title${it.kind === 'q' ? ' jp' : ''}">${esc(it.q)}</div>
      <div class="opts">${shuffle([it.a, ...it.d]).map(o => `<button type="button" class="opt jp" data-v="${esc(o)}"><span>${esc(o)}</span></button>`).join('')}</div></div>`).join('')}
    <div id="readScore"></div></div></div>`;
  $('#back', main).onclick = () => { UI.read = null; saveUI(); render(); };
  $$('.rq', main).forEach(box => {
    const it = items[+box.dataset.k];
    $$('.opt', box).forEach(b => b.onclick = () => {
      if (it.id in answers) return;
      const ok = b.dataset.v === it.a; answers[it.id] = ok;
      $$('.opt', box).forEach(x => { x.disabled = true; if (x.dataset.v === it.a) x.classList.add('right'); else if (x !== b) x.classList.add('dim'); });
      if (!ok) b.classList.add('wrong');
      record(it.id, 'read', ok, p.title + ' — ' + it.q);
      if (it.kind === 'blank') { const bl = $('#bl' + it.n, main); bl.textContent = it.a; bl.classList.add(ok ? 'ok' : 'bad'); }
      const opts = [it.a, ...it.d], chosen = opts.indexOf(b.dataset.v), tr = it.kind === 'q' ? [it.avi, ...(it.dvi || [])] : opts.map(meanOf);
      box.insertAdjacentHTML('beforeend', `<div class="explain">${it.vi ? `<div class="xsec"><div class="xt">Dịch câu hỏi</div><div>${esc(it.vi)}</div></div>` : ''}
        <div class="xsec"><div class="xt">Giải thích</div>${it.why ? `<div>${esc(it.why)}</div>` : ''}<ul class="xlist">${opts.map((o, i) =>
        `<li class="${i === 0 ? 'right' : i === chosen ? 'wrong' : ''}"><span class="xo jp">${esc(o)}</span><span class="xn">${tr[i] ? esc(tr[i]) : '<span class="muted">—</span>'}</span>${i === 0 ? '<span class="xm ok">Đáp án đúng</span>' : i === chosen ? '<span class="xm bad">Bạn chọn</span>' : ''}</li>`).join('')}</ul></div></div>`);
      if (Object.keys(answers).length === items.length) {
        const sc = Object.values(answers).filter(Boolean).length;
        const r = S.r[p.id] || (S.r[p.id] = { c: 0, w: 0, s: 0 });
        r.best = Math.max(r.best || 0, sc); r.s = sc === items.length ? 2 : 0; save();
        $('#readScore', main).innerHTML = `<div class="card result" style="${color('read')}"><div class="score">${sc}/${items.length}</div><div class="row"><button type="button" class="btn c" id="again">Làm lại bài này</button><button type="button" class="btn sec" id="other">Bài khác</button></div></div>`;
        $('#again', main).onclick = () => render();
        $('#other', main).onclick = () => { UI.read = null; saveUI(); render(); };
      }
    });
  });
}
const REVIEW = {
  vocab: ids => vocabQ('mean', ids.map(i => DB.vById[i]).filter(Boolean), 'miss|v'),
  kanji: ids => kanjiQ('hv', ids.map(i => DB.kById[i]).filter(Boolean), 'miss|k'),
  grammar: ids => grammarQ(ids.map(i => DB.gqById[i]).filter(Boolean), 'miss|g'),
  sent: ids => sentQ(ids.map(i => DB.sById[i]).filter(Boolean), 'miss|s'),
  syn: ids => synQ(ids.map(i => DB.yById[i]).filter(Boolean), 'miss|y') };
function renderMiss(main) {
  const by = {};
  Object.entries(S.m).forEach(([id, m]) => (by[m.sec] = by[m.sec] || []).push([id, m]));
  if (UI.miss && by[UI.miss] && REVIEW[UI.miss]) {
    const sec = UI.miss;
    main.innerHTML = `<div class="row"><button type="button" class="btn sec" id="back">${icon('back')} Sổ lỗi sai</button></div>` +
      pageHead('miss', 'Ôn lỗi sai · ' + SEC[sec].name, 'Trả lời đúng 2 lần liên tiếp thì câu đó được xoá khỏi sổ') + `<div class="stage"></div>`;
    $('#back', main).onclick = () => { UI.miss = null; saveUI(); render(); };
    const ids = () => Object.keys(S.m).filter(id => S.m[id].sec === sec);
    round($('.stage', main), 'miss', () => { const l = ids(); return l.length ? REVIEW[sec](l) : null; }, { size: Math.min(ROUND, Math.max(1, ids().length)) });
    return;
  }
  const total = Object.keys(S.m).length;
  main.innerHTML = pageHead('miss', 'Sổ lỗi sai', total ? `${total} câu cần ôn lại` : 'Câu nào trả lời sai sẽ được lưu ở đây') +
    (total ? '' : '<div class="empty">Chưa có lỗi sai nào. Làm vài lượt ôn, câu sai sẽ hiện ở đây.</div>') +
    Object.entries(by).map(([sec, list]) => `<div class="card" style="${color(sec === 'read' ? 'read' : sec)}">
      <div class="page-head"><span class="badge-ic">${icon(SEC[sec] ? SEC[sec].ic : 'more')}</span><div><h2>${esc(SEC[sec] ? SEC[sec].name : sec)}</h2><p>${list.length} câu</p></div></div>
      <div class="wlist" style="margin:10px 0">${list.sort((a, b) => b[1].n - a[1].n).slice(0, 30).map(([id, m]) => `<div class="wrow"><span class="jp">${esc((m.label || id).split(' — ')[0])}</span><span class="small">${esc((m.label || '').split(' — ')[1] || '')} <span class="muted">· sai ${m.n} lần</span></span></div>`).join('')}</div>
      ${REVIEW[sec] ? `<button type="button" class="btn c" data-run="${sec}">Ôn lại phần này</button>` : '<p class="small muted">Mở lại bài trong mục Đọc hiểu để làm lại.</p>'}</div>`).join('') +
    `<div class="card"><h2>Sao lưu tiến độ</h2><p class="small muted">Tiến độ lưu trong trình duyệt này. Xuất ra file JSON để giữ lại hoặc chuyển sang máy khác.</p>
      <div class="row"><button type="button" class="btn sec" id="exp">Xuất file JSON</button><label class="btn sec" for="imp">Nhập file JSON</label><input type="file" id="imp" accept="application/json,.json" hidden>
      <button type="button" class="btn danger" id="clr">Xoá sổ lỗi sai</button></div><p id="msg" class="small"></p></div>`;
  $$('[data-run]', main).forEach(b => b.onclick = () => { UI.miss = b.dataset.run; saveUI(); render(); });
  $('#exp', main).onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'jlpt-tien-do-' + today() + '.json'; a.click();
    $('#msg', main).textContent = 'Đã tạo file tiến độ.';
  };
  $('#imp', main).onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { const d = JSON.parse(t); if (!d.r) throw 0; S = Object.assign({ r: {}, m: {}, day: {} }, d); save(); badges(); render(); })
      .catch(() => { $('#msg', main).textContent = 'File không đúng định dạng tiến độ của trang này.'; });
  };
  let armed = false;
  $('#clr', main).onclick = e => { if (!armed) { armed = true; e.currentTarget.textContent = 'Bấm lần nữa để xoá'; return; } S.m = {}; save(); badges(); render(); };
}
function renderMix(main) {
  main.innerHTML = pageHead('home', 'Ôn nhanh', '10 câu trộn từ tất cả các phần') + `<div class="stage"></div>`;
  round($('.stage', main), 'home', mixQ);
}
function renderMore(main) {
  main.innerHTML = pageHead('more', 'Luyện thêm', 'Các phần ôn khác') + `<div class="hub">${['syn', 'sent', 'read', 'miss'].map(id => tileHTML(id)).join('')}</div>
    <div class="card"><h2>Giao diện</h2>
      <div class="flabel" style="margin-top:10px">Chế độ</div>${seg('theme', [['auto', 'Theo máy'], ['light', 'Sáng'], ['dark', 'Tối']], UI.theme)}
      <div class="flabel" style="margin-top:14px">Màu chủ đạo</div>
      <div class="swatches">${ACCENTS.map(([id, name]) => `<button type="button" class="swatch" data-accent="${id}" aria-pressed="${UI.accent === id}"><i class="sw-${id}"></i>${esc(name)}</button>`).join('')}</div></div>`;
  $$('[data-go]', main).forEach(b => b.onclick = () => go(b.dataset.go));
  $$('[data-k="theme"]', main).forEach(b => b.onclick = () => { UI.theme = b.dataset.v; saveUI(); applyTheme(); render(); });
  $$('[data-accent]', main).forEach(b => b.onclick = () => { UI.accent = b.dataset.accent; saveUI(); applyTheme(); render(); });
}
function sectionStats(id) {
  const ids = { vocab: () => DB.vocab.map(v => v.id), kanji: () => DB.kanji.map(k => k.id), grammar: () => DB.gq.map(x => x.id), syn: () => DB.synonyms.map(y => y.id),
    sent: () => DB.sentences.map(s => s.id), read: () => DB.reading.map(r => r.id) }[id];
  if (!ids) return null;
  const all = ids(), done = all.filter(learned).length;
  return { done, total: all.length, pct: all.length ? Math.round(100 * done / all.length) : 0 };
}
function tileHTML(id) {
  const s = SEC[id], st = sectionStats(id), miss = id === 'miss' ? Object.keys(S.m).length : 0;
  return `<button type="button" class="tile" data-go="${id}" style="${color(id)}">
    <div class="tile-top"><span class="badge-ic">${icon(s.ic)}</span><div><b>${esc(s.name)}</b><span class="sub">${esc(s.sub || '')}</span></div></div>
    ${st ? `<div class="bar"><i style="width:${st.pct}%"></i></div><div class="stats-row"><span>Đã thuộc ${st.done}/${st.total}</span><span>${st.pct}%</span></div>`
         : `<div class="stats-row"><span>${miss ? miss + ' câu cần ôn' : 'Chưa có lỗi sai'}</span></div>`}</button>`;
}
function renderHome(main) {
  const d = daysLeft(), span = Math.round((EXAM - START) / 86400000), pct = Math.max(0, Math.min(100, Math.round(100 * (span - d) / span)));
  const t = S.day[today()] || { n: 0, ok: 0 };
  const goalPct = Math.min(100, Math.round(100 * t.n / DAILY_GOAL));
  const week = Object.entries(S.day).filter(([k]) => (Date.now() - new Date(k)) / 86400000 < 7).reduce((s, [, v]) => s + v.n, 0);
  const lvStat = (arr, lv) => { const a = arr.filter(x => x.lv === lv); return [a.filter(x => learned(x.id)).length, a.length]; };
  const missN = Object.keys(S.m).length;
  main.innerHTML = `<section class="hero">
      <div class="ring" style="--p:${pct}"><div><span class="big">${Math.max(d, 0)}</span><small>ngày nữa</small></div></div>
      <div class="hero-text"><h1>${d > 0 ? 'Cố lên, sắp đến kỳ thi JLPT N3!' : d === 0 ? 'Hôm nay là ngày thi. Chúc bạn đỗ!' : 'Kỳ thi đã qua'}</h1>
        <p>Chủ nhật 06/12/2026 · 7 ngày qua bạn đã làm ${week} câu</p>
        <div class="row"><button type="button" class="btn" data-go="mix">${icon('bolt')} Ôn nhanh 10 câu</button>${missN ? `<button type="button" class="btn ghost" data-go="miss">Ôn ${missN} lỗi sai</button>` : ''}</div></div>
    </section>
    <div class="card goal" style="${color('home')}"><div><b>Mục tiêu hôm nay</b><div class="small muted">${t.n}/${DAILY_GOAL} câu · đúng ${t.n ? Math.round(100 * t.ok / t.n) : 0}%</div></div><div class="bar"><i style="width:${goalPct}%"></i></div></div>
    <h2>Các phần ôn tập</h2>
    <div class="tiles">${['vocab', 'kanji', 'grammar', 'syn', 'sent', 'read', 'miss'].map(tileHTML).join('')}</div>
    <h2>Theo cấp độ</h2>
    <div class="lvgrid">${['N5', 'N4', 'N3'].map(lv => { const [a, b] = lvStat(DB.vocab, lv), [c, e] = lvStat(DB.kanji, lv);
      return `<div class="card"><b>${lv}</b><div class="small" style="${color('vocab')}">Từ vựng ${a}/${b}<div class="bar"><i style="width:${b ? 100 * a / b : 0}%"></i></div></div>
        <div class="small" style="${color('kanji')}">Kanji ${c}/${e}<div class="bar"><i style="width:${e ? 100 * c / e : 0}%"></i></div></div></div>`; }).join('')}</div>
    <p class="small muted">Một mục được tính là "đã thuộc" khi bạn trả lời đúng 2 lần liên tiếp.</p>`;
  $$('[data-go]', main).forEach(b => b.onclick = () => go(b.dataset.go));
}

// ---------------- navigation
const VIEWS = { home: renderHome, vocab: renderVocab, kanji: renderKanji, grammar: renderGrammar, syn: renderSyn, sent: renderSent, read: renderRead, miss: renderMiss, mix: renderMix, more: renderMore };
const BOTTOM = ['home', 'vocab', 'kanji', 'grammar', 'more'];
function buildNav() {
  $('#sideLinks').innerHTML = SECTIONS.map(s => `<button type="button" data-tab="${s.id}" style="${color(s.id)}">${icon(s.ic)}<span>${esc(s.name)}</span>${s.id === 'miss' ? '<span class="dot" id="dotSide"></span>' : ''}</button>`).join('');
  $('#bottomNav').innerHTML = BOTTOM.map(id => { const s = SEC[id] || { name: 'Luyện thêm', ic: 'more' };
    return `<button type="button" data-tab="${id}" style="${color(id)}">${icon(s.ic)}<span>${esc(s.name)}</span>${id === 'more' ? '<span class="dot" id="dotBottom"></span>' : ''}</button>`; }).join('');
  $$('[data-tab]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); go(b.dataset.tab); }));
}
function badges() {
  const n = Object.keys(S.m).length;
  ['#dotSide', '#dotBottom'].forEach(s => { const el = $(s); if (el) el.textContent = n ? (n > 99 ? '99+' : n) : ''; });
}
const ACCENTS = [['indigo', 'Chàm'], ['sakura', 'Hoa anh đào'], ['matcha', 'Trà xanh'], ['ocean', 'Biển'], ['sunset', 'Hoàng hôn']];
function applyTheme() {
  if (UI.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', UI.theme);
  document.documentElement.setAttribute('data-accent', UI.accent || 'indigo');
  $('#themeBtn').textContent = 'Giao diện: ' + { auto: 'tự động', light: 'sáng', dark: 'tối' }[UI.theme];
}
$('#themeBtn').onclick = () => { UI.theme = { auto: 'light', light: 'dark', dark: 'auto' }[UI.theme]; saveUI(); applyTheme(); };
function render() {
  KEYS = null;
  const main = $('#main');
  const t = UI.tab;
  const navId = ['syn', 'sent', 'read', 'miss', 'more'].includes(t) ? 'more' : t === 'mix' ? 'home' : t;
  $$('#sideLinks [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === (t === 'mix' ? 'home' : t) ? 'page' : 'false'));
  $$('#bottomNav [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === navId ? 'page' : 'false'));
  (VIEWS[t] || renderHome)(main);
  const d = daysLeft(), txt = d > 0 ? 'Còn ' + d + ' ngày' : '';
  $('#topCount').textContent = txt; $('#sideCount').textContent = txt;
}
function go(tab) {
  if (!VIEWS[tab]) tab = 'home';
  UI.tab = tab; UI.picker = null; if (tab === 'miss') UI.miss = null; if (tab === 'read') UI.read = null; UI.listQ = '';
  saveUI(); render(); window.scrollTo(0, 0);
  if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
}
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (VIEWS[t] && t !== UI.tab) go(t); });

buildNav(); applyTheme();
loadData().then(() => {
  const t = location.hash.slice(1); if (VIEWS[t]) UI.tab = t;
  badges(); render();
}).catch(err => {
  $('#main').innerHTML = `<div class="empty">Không tải được dữ liệu (${esc(err.message)}). Nếu bạn mở file trực tiếp trên máy, hãy chạy <code>python3 -m http.server</code> trong thư mục này rồi mở <code>http://localhost:8000</code>.</div>`;
});
