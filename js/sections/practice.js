// Mẫu câu (#/sent), Ngữ pháp (#/more/grammar[/nhóm]), Từ đồng nghĩa (#/more/syn).
import { $, $$, esc, color, romaji } from '../core/util.js';
import { DB, meanOf } from '../core/data.js';
import { prefs, learned, countLearned } from '../core/store.js';
import { pickItem } from '../core/deck.js';
import { register } from '../core/router.js';
import { round, ROUND } from '../core/quiz.js';
import { speakBtn } from '../core/speech.js';
import { pageHead, cardGrid, seg, bindSeg, listSearch, bindCardSearch, lvTag } from '../core/ui.js';

const blankHTML = s => esc(s).replace('（　　）', '<span class="blank">（　　）</span>');
const LVS = [['all', 'Mọi cấp'], ['N5', 'N5'], ['N4', 'N4'], ['N3', 'N3']];

// ---------------- Mẫu câu: 文脈規定 + 言い換え
export function sentQ(pool, scope) {
  if (!pool.length) return null;
  const s = pickItem(pool, x => x.id, scope), para = s.kind === '言い換え', opts = [s.a, ...s.d];
  const html = para ? esc(s.s).replace(/［(.+?)］/, '<u class="mark">$1</u>') : blankHTML(s.s);
  const marked = para ? (s.s.match(/［(.+?)］/) || [, ''])[1] : '';
  const full = para ? s.s.replace(/［|］/g, '') : s.s.replace('（　　）', s.a);
  return { id: s.id, sec: 'sent', label: s.s, tag: s.kind + (s.lv ? ' · ' + s.lv : ''), prompt: `<div class="sentence">${html}</div>`,
    ask: para ? 'Chọn cách nói gần nghĩa nhất với phần gạch chân' : 'Chọn từ phù hợp nhất để điền vào chỗ trống',
    opts, answer: 0, jp: true, say: full, sayAfter: true, vi: s.vi, full, notes: opts.map(meanOf),
    why: para ? `「${marked}」${meanOf(marked) ? ' (' + meanOf(marked) + ')' : ''} gần nghĩa nhất với 「${s.a}」.` : `Chỉ 「${s.a}」 hợp với nghĩa của cả câu.` };
}
const KINDS = [['all', 'Tất cả'], ['文脈規定', '文脈規定 · điền từ'], ['言い換え', '言い換え · gần nghĩa']];
register({
  id: 'sent', name: 'Mẫu câu', icon: 'sent', order: 30, tile: { sub: '文脈規定 · 言い換え', stat: () => [countLearned(DB.sentences.map(s => s.id)), DB.sentences.length] },
  render(main) {
    const kind = prefs.sKind || 'all';
    main.innerHTML = pageHead('sent', 'Mẫu câu', DB.sentences.length + ' câu điền từ và chọn cách nói gần nghĩa, như phần 文字・語彙 của đề') +
      `<div class="card topicbar" style="${color('sent')}"><span class="flabel">Dạng bài</span>${seg('sKind', KINDS, kind)}</div><div class="stage" style="${color('sent')}"></div>`;
    bindSeg(main, () => this.render(main));
    round($('.stage', main), 'sent', () => sentQ(DB.sentences.filter(s => kind === 'all' || s.kind === kind), 's|' + kind));
  }
});

// ---------------- Ngữ pháp: chọn nhóm → điền chỗ trống
export function grammarInfo(g, all = false) {
  const th = g.th || {};
  return `<div class="jp-line"><b>${esc(g.p)}</b>${lvTag(g.lv)}</div><div>${esc(g.mean)}</div>
    ${th.form || g.struct ? `<div class="th"><b>Cấu trúc</b><span class="jp">${esc(th.form || g.struct)}</span></div>` : ''}
    ${th.use ? `<div class="th"><b>Cách dùng</b><span>${esc(th.use)}</span></div>` : ''}
    ${th.note ? `<div class="th"><b>Lưu ý</b><span>${esc(th.note)}</span></div>` : ''}
    ${g.ex.length ? '<div class="small muted">Ví dụ</div>' : ''}
    ${g.ex.slice(0, all ? 99 : 2).map(e => `<div class="jp small">${esc(e.jp)} ${speakBtn(e.jp)}</div>${e.vi ? `<div class="small muted">${esc(e.vi)}</div>` : ''}`).join('')}
    ${all ? '' : `<div class="small"><a href="#/more/grammar/p/${g.id}">Xem lý thuyết và luyện riêng mẫu này →</a></div>`}`;
}
// search key: pattern, meaning, romaji of the pattern (so "ni naru" finds Aく／Aに＋なる)
const gKey = g => (g.p + ' ' + g.mean + ' ' + romaji(g.p) + ' ' + romaji(g.p).replace(/ /g, '')).toLowerCase();
const norm = q => q.toLowerCase().trim();
function gMatch(g, q) { q = norm(q); return !q || gKey(g).includes(q) || gKey(g).includes(q.replace(/\s+/g, '')); }
function patternPage(main, id) {
  const g = DB.grammar.find(x => x.id === id);
  if (!g) { main.innerHTML = '<div class="empty">Không tìm thấy mẫu này.</div>'; return; }
  const qs = DB.gq.filter(x => x.g === g), sib = DB.grammar.filter(x => x.grp === g.grp && x.lv === g.lv), k = sib.indexOf(g);
  const nav = (x, t) => x ? `<a class="btn sec" href="#/more/grammar/p/${x.id}">${t} ${esc(x.p)}</a>` : '';
  main.innerHTML = pageHead('grammar', g.p, g.lv + (g.grp ? ' · ' + g.grp : ''), [g.grp || 'Ngữ pháp', g.grp ? '#/more/grammar/' + encodeURIComponent(g.grp) : '#/more/grammar']) +
    `<div class="card" style="${color('grammar')}"><h2>Lý thuyết</h2><div class="info">${grammarInfo(g, true)}</div></div>
    <div class="card" style="${color('grammar')}"><h2>Luyện mẫu này</h2><p class="small muted">${qs.length} câu điền chỗ trống, chỉ dùng mẫu ${esc(g.p)}; đã thuộc ${countLearned(qs.map(x => x.id))}/${qs.length}.</p>
    ${qs.length ? '<button type="button" class="btn c" id="gp">Bắt đầu luyện</button>' : '<p class="small">Mẫu này chưa có câu luyện tập.</p>'}</div>
    <div class="stage" style="${color('grammar')}"></div><div class="row">${nav(sib[k - 1], '←')}${nav(sib[k + 1], '→')}</div>`;
  const b = $('#gp', main);
  if (b) b.onclick = () => { b.closest('.card').remove(); round($('.stage', main), 'grammar', () => grammarQ(qs, 'gp|' + g.id), { size: Math.min(ROUND, Math.max(qs.length, 4)), back: ['Lý thuyết', '#/more/grammar/p/' + g.id] }); };
}
// meaning of a wrong option that is not a vocabulary word: the grammar pattern it belongs to, else a plain hint
let GL = null;
function gramGloss(o, own) {
  if (!GL) { GL = new Map(); for (const g of DB.grammar) for (const c of [...(g.cores || []), ...g.p.split(/[／・＋〜、（）\s]+/)]) if (c && (!GL.has(c) || GL.get(c).p.length > g.p.length)) GL.set(c, g); }
  const g = GL.get(o) || GL.get(o.replace(/^(て|で|た|だ|に|が|を|の)/, ''));
  if (g && g !== own) return 'là mẫu ' + g.p + ': ' + g.mean;
  return 'dạng này không hợp nghĩa / ngữ pháp ở câu này';
}
export function grammarQ(pool, scope) {
  if (!pool.length) return null;
  const x = pickItem(pool, y => y.id, scope), opts = [x.q.a, ...x.q.d];
  return { id: x.id, sec: 'grammar', label: x.g.p, tag: 'Ngữ pháp ' + x.g.lv + (x.g.grp ? ' · ' + x.g.grp : ''),
    prompt: `<div class="sentence">${blankHTML(x.q.s)}</div>`, ask: 'Chọn mẫu điền vào chỗ trống', opts, answer: 0, jp: true,
    say: x.q.s.replace('（　　）', x.q.a), sayAfter: true, vi: x.q.vi, full: x.q.s.replace('（　　）', x.q.a),
    notes: opts.map((o, i) => i ? (meanOf(o) || gramGloss(o, x.g)) : 'mẫu ' + x.g.p + ': ' + x.g.mean), why: `Câu cần ý "${x.g.mean}", nên dùng mẫu ${x.g.p}.`, info: grammarInfo(x.g) };
}
register({
  id: 'grammar', name: 'Ngữ pháp', icon: 'grammar', parent: 'more', order: 62, tile: { sub: 'Chọn nhóm, điền chỗ trống', stat: () => [countLearned(DB.gq.map(x => x.id)), DB.gq.length] },
  render(main, [grp, pid]) {
    const lv = prefs.gLv || 'all', inLv = x => lv === 'all' || x.g.lv === lv;
    if (grp === 'p') return patternPage(main, pid);
    if (!grp) {
      const all = DB.gq.filter(inLv);
      const items = DB.groups.map(name => { const qs = all.filter(x => x.g.grp === name);
        return { href: '#/more/grammar/' + encodeURIComponent(name), title: name, sub: [...new Set(qs.map(x => x.g.p))].slice(0, 3).join(' · '), done: countLearned(qs.map(x => x.id)), total: qs.length }; }).filter(t => t.total);
      main.innerHTML = pageHead('grammar', 'Ngữ pháp', 'Chọn nhóm, hoặc tìm một mẫu để xem lý thuyết và luyện riêng mẫu đó', ['Mục khác', '#/more']) +
        `<div style="${color('grammar')}"><div class="row">${seg('gLv', LVS, lv)}</div>
        <input type="search" class="tsearch" placeholder="Tìm mẫu: になる, ni naru, trở nên, 〜ても…"><div class="wlist" id="gres"></div>
        ${cardGrid([{ href: '#/more/grammar/all', title: 'Tất cả mẫu ngữ pháp', done: countLearned(all.map(x => x.id)), total: all.length, cls: 'wide' }, ...items])}</div>`;
      bindSeg(main, () => this.render(main, []));
      const inp = $('.tsearch', main), res = $('#gres', main);
      inp.oninput = () => {
        const q = inp.value; bindCardSearchFilter(main, q);
        const hits = q.trim() ? DB.grammar.filter(g => (lv === 'all' || g.lv === lv) && gMatch(g, q)).slice(0, 40) : [];
        res.innerHTML = hits.map(g => `<a class="wrow" href="#/more/grammar/p/${g.id}"><span class="jp"><b>${esc(g.p)}</b></span>${lvTag(g.lv)}<span class="small muted">${esc(g.mean.slice(0, 70))}</span></a>`).join('')
          + (q.trim() && !hits.length ? '<div class="small muted">Không có mẫu nào khớp.</div>' : '');
      };
      return;
    }
    const pool = DB.gq.filter(x => inLv(x) && (grp === 'all' || x.g.grp === grp)), view = prefs.gView || 'quiz';
    main.innerHTML = pageHead('grammar', grp === 'all' ? 'Tất cả mẫu ngữ pháp' : grp, 'Đã thuộc ' + countLearned(pool.map(x => x.id)) + '/' + pool.length, ['Đổi nhóm', '#/more/grammar']) +
      `<div class="card topicbar" style="${color('grammar')}">${seg('gView', [['quiz', 'Điền chỗ trống'], ['list', 'Lý thuyết']], view)}</div><div class="stage" style="${color('grammar')}"></div>`;
    bindSeg(main, () => this.render(main, [grp]));
    const st = $('.stage', main);
    if (view === 'list') listSearch(st, DB.grammar.filter(g => inLv({ g }) && (grp === 'all' || g.grp === grp)).map(g => ({ text: gKey(g),
      html: `<a class="wrow" href="#/more/grammar/p/${g.id}"><span class="jp"><b>${esc(g.p)}</b></span>${lvTag(g.lv)}<span class="small muted">${esc(g.mean.slice(0, 80))}</span><span class="small muted">· ${DB.gq.filter(x => x.g === g).length} câu</span></a>` })));
    else round(st, 'grammar', () => grammarQ(pool, 'g|' + lv + '|' + grp), { back: ['Đổi nhóm', '#/more/grammar'] });
  }
});

function bindCardSearchFilter(main, q) {          // hide group cards that do not match (group name or one of its patterns)
  q = norm(q);
  $$('.ccard', main).forEach(c => { const t = c.textContent.toLowerCase(); c.style.display = !q || t.includes(q) ? '' : 'none'; });
}

// ---------------- Từ đồng nghĩa
const POS = { all: 'Tất cả', n: 'Danh từ', v: 'Động từ', a: 'Tính từ', d: 'Phó từ · từ nối' };
export function synQ(pool, scope) {
  if (!pool.length) return null;
  const y = pickItem(pool, x => x.id, scope), opts = [y.a, ...y.d];
  return { id: y.id, sec: 'syn', label: y.w + ' — ' + y.a, tag: POS[y.pos] + ' · ' + y.lv,
    prompt: `<div class="word">${esc(y.w)}</div>${y.r ? `<div class="reading">${esc(y.r)}</div>` : ''}`,
    ask: 'Từ nào gần nghĩa nhất với từ này?', opts, answer: 0, jp: true, say: y.r || y.w,
    notes: opts.map(meanOf), why: `${y.w}${y.r ? '【' + y.r + '】' : ''} nghĩa là "${y.vi}", cùng nghĩa với ${y.a}.`,
    info: `<div class="jp-line">${esc(y.w)} ≈ ${esc(y.a)}${lvTag(y.lv)}</div><div>Nghĩa: ${esc(y.vi)}</div>` };
}
register({
  id: 'syn', name: 'Từ đồng nghĩa', icon: 'syn', parent: 'more', order: 61, tile: { sub: 'Chọn từ gần nghĩa nhất (言い換え類義)', stat: () => [countLearned(DB.synonyms.map(y => y.id)), DB.synonyms.length] },
  render(main) {
    const pos = prefs.yPos || 'all', lv = prefs.yLv || 'all';
    main.innerHTML = pageHead('syn', 'Từ đồng nghĩa', DB.synonyms.length + ' cặp từ đồng nghĩa hay gặp', ['Mục khác', '#/more']) +
      `<div class="card topicbar" style="${color('syn')}"><div>${seg('yPos', Object.entries(POS), pos)}</div><div>${seg('yLv', LVS, lv)}</div></div><div class="stage" style="${color('syn')}"></div>`;
    bindSeg(main, () => this.render(main));
    round($('.stage', main), 'syn', () => synQ(DB.synonyms.filter(y => (pos === 'all' || y.pos === pos) && (lv === 'all' || y.lv === lv)), 'y|' + pos + '|' + lv), { back: ['Mục khác', '#/more'] });
  }
});
