// Kanji: #/kanji/<level> = lưới chữ + luyện cả cấp · #/kanji/<level>/quiz/<mode> · #/kanji/<level>/<kanji id> = một chữ + luyện các từ ghép của nó
// Câu "cách đọc" dùng đáp án nhiễu có cách đọc gần giống (similarReadings).
import { $, esc, shuffle, pick, HAS_KANJI, color } from '../core/util.js';
import { DB, levelAvailable } from '../core/data.js';
import { prefs, savePrefs, learned, countLearned } from '../core/store.js';
import { pickItem, distract, takeDistinct, similarReadings } from '../core/deck.js';
import { register, go } from '../core/router.js';
import { round } from '../core/quiz.js';
import { speakBtn } from '../core/speech.js';
import { pageHead, levelBar, cardGrid, lvTag, bar } from '../core/ui.js';

const LEVEL_MODES = [['hv', 'Chữ → âm Hán Việt'], ['word', 'Từ ghép → nghĩa'], ['wread', 'Từ ghép → cách đọc']];
const usable = k => k.words.filter(w => w.r && w.vi && HAS_KANJI.test(w.w) && !w.w.includes('・'));
const kwId = w => 'kw|' + w.w;

export function kanjiInfo(k) {
  return `<div class="kanji-head"><span class="kanji">${esc(k.k)}</span><div><div><b>${esc(k.hv)}</b>${lvTag(k.lv)}</div>
    <div class="small">Âm On: <span class="jp">${esc(k.on || '—')}</span></div><div class="small">Âm Kun: <span class="jp">${esc(k.kun || '—')}</span></div></div></div>
    ${k.story ? `<div class="story small">${esc(k.story)}</div>` : ''}
    <div class="words">${k.words.map(w => `<div class="wrow"><span class="jp">${esc(w.w)}</span><span><span class="jp muted">${esc(w.r)}</span>${w.vi ? ' · ' + esc(w.vi) : ''}${lvTag(w.lv)}</span></div>`).join('')}</div>`;
}
const hl = (w, k) => esc(w.w).split(esc(k.k)).join(`<span style="color:var(--c)">${esc(k.k)}</span>`);

// question about one compound word w of kanji k; mode 'wread' (similar-reading distractors) or 'word' (meaning)
function wordQ(k, w, mode, id) {
  const why = `${w.w} đọc là ${w.r}, nghĩa là "${w.vi}" (chữ ${k.k} – ${k.hv}).`;
  const others = DB.allKanjiWords.filter(x => x.w !== w.w && x.vi !== w.vi && x.r !== w.r);
  if (mode === 'wread') {
    const items = [w, ...similarReadings(w, others)];
    if (items.length < 4) return null;
    return { id, sec: 'kanji', label: w.w + ' (' + k.k + ')', tag: 'Kanji ' + k.lv + ' · ' + k.k, prompt: `<div class="word">${hl(w, k)}</div>`, ask: 'Chọn cách đọc của từ ghép',
      opts: items.map(x => x.r), notes: items.map(x => 'là cách đọc của ' + x.w + (x.vi ? ' (' + x.vi + ')' : '')), why, answer: 0, jp: true, say: w.r, info: kanjiInfo(k) };
  }
  const items = [w, ...takeDistinct(w, 'vi', shuffle(others.filter(x => x.lv === k.lv)).concat(shuffle(others).slice(0, 200)))];
  return { id, sec: 'kanji', label: w.w + ' (' + k.k + ')', tag: 'Kanji ' + k.lv + ' · ' + k.k, prompt: `<div class="word">${hl(w, k)}</div><div class="reading">${esc(w.r)}</div>`,
    ask: 'Từ ghép này nghĩa là gì?', opts: items.map(x => x.vi), notes: items.map(x => 'là nghĩa của ' + x.w + '【' + x.r + '】'), why, answer: 0, say: w.r, info: kanjiInfo(k) };
}

export function kanjiQ(mode, pool, scope, tries = 0) {
  if (!pool.length) return null;
  const k = pickItem(pool, x => x.id, scope);
  if (mode === 'hv') {
    const opts = [k.hv, ...distract(k.hv, DB.kanji.filter(x => x.lv === k.lv && x.hv !== k.hv).map(x => x.hv))];
    return { id: k.id, sec: 'kanji', label: k.k + ' — ' + k.hv, tag: 'Kanji ' + k.lv, prompt: `<div class="kanji">${esc(k.k)}</div>`, ask: 'Âm Hán Việt của chữ này là gì?', opts, answer: 0,
      notes: opts.map(o => 'âm Hán Việt của ' + (DB.hv[o] || []).slice(0, 4).join('、')), why: `${k.k} đọc Hán Việt là ${k.hv}. Âm On: ${k.on || '—'}, âm Kun: ${k.kun || '—'}.`, info: kanjiInfo(k) };
  }
  const words = usable(k);
  if (!words.length) return tries < 20 ? kanjiQ(mode, pool, scope, tries + 1) : null;
  return wordQ(k, pick(words), mode, k.id);
}

function levelPage(main, level) {
  const counts = {};
  DB.levels.filter(l => l.available).forEach(l => { const ids = DB.kanji.filter(k => k.lv === l.id).map(k => k.id); counts[l.id] = [countLearned(ids), ids.length]; });
  const ks = DB.kanji.filter(k => k.lv === level);
  main.innerHTML = pageHead('kanji', 'Kanji', 'Bấm vào một chữ để xem và luyện các từ ghép tạo từ chữ đó') + levelBar(level, id => '#/kanji/' + id, counts) +
    `<div style="${color('kanji')}"><div class="card practice-row"><b>Luyện cả cấp ${level}</b><div class="row">${LEVEL_MODES.map(([m, n]) => `<a class="btn c" href="#/kanji/${level}/quiz/${m}">${n}</a>`).join('')}</div></div>
    <input type="search" class="tsearch" placeholder="Tìm chữ, âm Hán Việt hoặc từ ghép…" aria-label="Tìm kanji">
    <div class="kgrid">${ks.map(k => `<a class="kcard${learned(k.id) ? ' done' : ''}" href="#/kanji/${level}/${k.id}" data-text="${esc((k.k + ' ' + k.hv + ' ' + k.words.map(w => w.w + ' ' + w.vi).join(' ')).toLowerCase())}">
      <span class="kc">${esc(k.k)}</span><b>${esc(k.hv)}</b><span class="kw jp">${k.words.slice(0, 3).map(w => esc(w.w)).join('、')}</span></a>`).join('')}</div></div>`;
  const q = $('.tsearch', main);
  q.oninput = () => { const s = q.value.trim().toLowerCase(); main.querySelectorAll('.kcard').forEach(c => c.hidden = s && !c.dataset.text.includes(s)); };
}

function kanjiPage(main, level, k) {
  const words = usable(k), ids = words.map(kwId), modes = [['wread', 'Cách đọc (đáp án gần giống)'], ['word', 'Nghĩa']];
  const mode = modes.some(m => m[0] === prefs.kwMode) ? prefs.kwMode : 'wread';
  main.innerHTML = pageHead('kanji', k.k + ' — ' + k.hv, words.length + ' từ ghép để luyện', ['Danh sách kanji ' + level, '#/kanji/' + level]) +
    `<div class="kdetail" style="${color('kanji')}"><div class="card info">${kanjiInfo(k)}${speakBtn(k.words[0] && k.words[0].r)}</div>
    <div><div class="card topicbar"><div class="tb-text"><span class="flabel">Từ ghép của ${esc(k.k)}</span>${bar(Math.round(100 * countLearned(ids) / (ids.length || 1)))}<span class="small muted">Đã thuộc ${countLearned(ids)}/${ids.length}</span></div>
    <div class="seg">${modes.map(([v, n]) => `<button type="button" data-m="${v}" aria-pressed="${v === mode}">${n}</button>`).join('')}</div></div><div class="stage"></div></div></div>`;
  main.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { prefs.kwMode = b.dataset.m; savePrefs(); kanjiPage(main, level, k); });
  const st = $('.stage', main);
  if (!words.length) { st.innerHTML = '<div class="empty">Chữ này chưa có từ ghép có nghĩa trong dữ liệu.</div>'; return; }
  round(st, 'kanji', () => { const w = pickItem(words, x => x.w, 'kw|' + k.id + '|' + mode); return wordQ(k, w, mode, kwId(w)); },
    { size: Math.min(10, Math.max(3, words.length * 2)), back: ['Chữ khác', '#/kanji/' + level] });
}

register({
  id: 'kanji', name: 'Kanji', icon: 'kanji', order: 20, tile: { sub: 'Chữ, âm Hán Việt và từ ghép', stat: () => [countLearned(DB.kanji.map(k => k.id)), DB.kanji.length] },
  render(main, [level, a, b]) {
    if (!level || !levelAvailable(level)) return go('kanji/' + (levelAvailable(prefs.kLevel) ? prefs.kLevel : 'N3'));
    prefs.kLevel = level; savePrefs();
    if (!a) return levelPage(main, level);
    if (a === 'quiz') {
      const mode = LEVEL_MODES.some(m => m[0] === b) ? b : 'hv', pool = DB.kanji.filter(k => k.lv === level);
      main.innerHTML = pageHead('kanji', 'Luyện Kanji ' + level, LEVEL_MODES.find(m => m[0] === mode)[1], ['Danh sách kanji ' + level, '#/kanji/' + level]) + `<div class="stage" style="${color('kanji')}"></div>`;
      return round($('.stage', main), 'kanji', () => kanjiQ(mode, pool, 'k|' + level + '|' + mode), { back: ['Danh sách kanji', '#/kanji/' + level] });
    }
    const k = DB.kById[a];
    if (!k) return go('kanji/' + level);
    kanjiPage(main, level, k);
  }
});
