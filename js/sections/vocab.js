// Từ mới: #/vocab/<level> = chọn chủ đề (có tiến độ) · #/vocab/<level>/<topic> = luyện
import { $, esc, shuffle, HAS_KANJI, color } from '../core/util.js';
import { DB, levelAvailable } from '../core/data.js';
import { prefs, savePrefs, learned, countLearned } from '../core/store.js';
import { pickItem, takeDistinct } from '../core/deck.js';
import { register, go } from '../core/router.js';
import { round } from '../core/quiz.js';
import { speakBtn } from '../core/speech.js';
import { pageHead, levelBar, cardGrid, seg, bindSeg, listSearch, bindCardSearch, lvTag, bar } from '../core/ui.js';

const MODES = [['mean', 'Từ → nghĩa'], ['read', 'Kanji → cách đọc'], ['rev', 'Nghĩa → từ'], ['list', 'Danh sách']];
const wordWithReading = v => v.w + (v.r && v.r !== v.w ? '【' + v.r + '】' : '');

// ---- pools: a "topic" is a filter over words of one level
function pool(level, topic) {
  return DB.vocab.filter(v => v.lv === level && (topic === 'all' || v.t === topic));
}
function topicName(level, topic) {
  if (topic === 'all') return 'Tất cả từ ' + level;
  return DB.topicName[topic] || topic;
}

export function vocabInfo(v) {
  return `<div class="jp-line">${esc(v.w)}${v.r ? '【' + esc(v.r) + '】' : ''}${lvTag(v.lv)}${speakBtn(v.r || v.w)}</div><div>${esc(v.vi)}</div>
    ${v.en ? `<div class="small muted">Nghĩa gốc (EN): ${esc(v.en)}</div>` : ''}${v.ex ? `<div class="jp small muted">${esc(v.ex)}</div>` : ''}
    ${v.t ? `<div class="small muted">Chủ đề: ${esc(DB.topicName[v.t] || v.t)}${v.src === 'extra' ? ' · nghĩa dịch máy, có thể chưa sát' : ''}</div>` : ''}`;
}

export function vocabQ(mode, items, scope, sec = 'vocab') {
  if (mode === 'read') items = items.filter(v => HAS_KANJI.test(v.w) && v.r);
  if (!items.length) return null;
  const v = pickItem(items, x => x.id, scope);
  const fair = x => x.id !== v.id && x.w !== v.w && x.vi !== v.vi && (!v.r || x.r !== v.r);
  const near = items.filter(fair), lvPool = shuffle(DB.vocab.filter(x => (x.lv === v.lv || !v.lv) && fair(x)));
  let picked, opts, notes, prompt, ask, jp = false, why;
  if (mode === 'mean') {
    picked = [v, ...takeDistinct(v, 'vi', shuffle(near).concat(lvPool.slice(0, 400)))];
    opts = picked.map(x => x.vi); notes = picked.map(x => 'là nghĩa của ' + wordWithReading(x));
    prompt = `<div class="word">${esc(v.w)}</div>${v.r && HAS_KANJI.test(v.w) ? `<div class="reading">${esc(v.r)}</div>` : ''}`;
    ask = 'Từ này nghĩa là gì?'; why = `${wordWithReading(v)} nghĩa là "${v.vi}".`;
  } else if (mode === 'read') {
    let same = near.concat(lvPool).filter(x => x.r && HAS_KANJI.test(x.w) && Math.abs(x.r.length - v.r.length) <= 1);
    if (new Set(same.map(x => x.r)).size < 6) same = same.concat(lvPool.filter(x => x.r));
    picked = [v, ...takeDistinct(v, 'r', same)]; opts = picked.map(x => x.r); jp = true;
    notes = picked.map(x => 'là cách đọc của ' + x.w + ' (' + x.vi + ')');
    prompt = `<div class="word">${esc(v.w)}</div>`; ask = 'Chọn cách đọc đúng'; why = `${v.w} đọc là ${v.r}, nghĩa là "${v.vi}".`;
  } else {
    picked = [v, ...takeDistinct(v, 'w', shuffle(near).concat(lvPool.slice(0, 300)))]; opts = picked.map(x => x.w); jp = true;
    notes = picked.map(x => (x.r && x.r !== x.w ? '【' + x.r + '】 ' : '') + x.vi);
    prompt = `<div class="meaning">${esc(v.vi)}</div>`; ask = 'Chọn từ tiếng Nhật đúng'; why = `"${v.vi}" là ${wordWithReading(v)}.`;
  }
  if (opts.length < 4) return null;
  return { id: v.id, sec, label: v.w + ' — ' + v.vi, tag: (DB.topicName[v.t] || '') + (v.lv ? ' · ' + v.lv : ''), prompt, ask, opts, answer: 0, jp,
    say: mode === 'rev' ? '' : (v.r || v.w), notes, why, info: vocabInfo(v) };
}

// ---- pages
function levelPage(main, level) {
  const counts = {};
  DB.levels.filter(l => l.available).forEach(l => { const ids = DB.vocab.filter(v => v.lv === l.id).map(v => v.id); counts[l.id] = [countLearned(ids), ids.length]; });
  const cnt = {}, done = {};
  DB.vocab.filter(v => v.lv === level).forEach(v => { cnt[v.t] = (cnt[v.t] || 0) + 1; if (learned(v.id)) done[v.t] = (done[v.t] || 0) + 1; });
  const groups = {};
  DB.topics.forEach(t => { if (cnt[t.id]) (groups[t.group] = groups[t.group] || []).push({ href: `#/vocab/${level}/${t.id}`, title: t.name, done: done[t.id] || 0, total: cnt[t.id] }); });
  const allIds = DB.vocab.filter(v => v.lv === level).map(v => v.id);
  let html = pageHead('vocab', 'Từ mới', 'Chọn cấp độ rồi chọn chủ đề để luyện') + levelBar(level, id => '#/vocab/' + id, counts) +
    `<div style="${color('vocab')}"><input type="search" class="tsearch" placeholder="Tìm chủ đề…" aria-label="Tìm chủ đề">
    ${cardGrid([{ href: `#/vocab/${level}/all`, title: 'Tất cả từ ' + level, done: countLearned(allIds), total: allIds.length, cls: 'wide' }])}
    ${Object.entries(groups).map(([g, items]) => `<section class="tgroup"><h2>${esc(g)}</h2>${cardGrid(items)}</section>`).join('')}`;
  main.innerHTML = html + '</div>';
  bindCardSearch(main, $('.tsearch', main));
}

function drillPage(main, level, topic) {
  const items = pool(level, topic);
  const ids = items.map(v => v.id), back = ['Đổi chủ đề', '#/vocab/' + level];
  main.innerHTML = pageHead('vocab', topicName(level, topic), 'Cấp ' + level + ' · mỗi lượt 10 câu, không lặp lại cho tới khi hết chủ đề', back) +
    `<div class="card topicbar" style="${color('vocab')}"><div class="tb-text"><span class="flabel">Tiến độ chủ đề</span>${bar(Math.round(100 * countLearned(ids) / (ids.length || 1)))}<span class="small muted">Đã thuộc ${countLearned(ids)}/${ids.length}</span></div>
     <div>${seg('vMode', MODES, prefs.vMode)}</div></div><div class="stage" style="${color('vocab')}"></div>`;
  bindSeg(main, () => drillPage(main, level, topic));
  const st = $('.stage', main);
  if (prefs.vMode === 'list') listSearch(st, items.map(v => ({ text: v.w + ' ' + (v.r || '') + ' ' + v.vi,
    html: `<div class="wrow"><span class="jp">${esc(v.w)}${learned(v.id) ? '<span class="ok-mark">✓</span>' : ''}</span><span>${v.r ? `<span class="jp muted">${esc(v.r)}</span> · ` : ''}${esc(v.vi)}${lvTag(v.lv)}</span></div>` })));
  else round(st, 'vocab', () => vocabQ(prefs.vMode, items, ['v', level, topic, prefs.vMode].join('|')), { back });
}

register({
  id: 'vocab', name: 'Từ mới', icon: 'vocab', order: 10, tile: { sub: 'Theo cấp độ và chủ đề', stat: () => [countLearned(DB.vocab.map(v => v.id)), DB.vocab.length] },
  render(main, [level, topic]) {
    if (!level || !levelAvailable(level)) return go('vocab/' + (levelAvailable(prefs.level) ? prefs.level : 'N3'));
    prefs.level = level; savePrefs();
    if (!topic) return levelPage(main, level);
    drillPage(main, level, topic);
  }
});
