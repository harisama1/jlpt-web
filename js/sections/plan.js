// Kế hoạch hôm nay (#/plan): còn N ngày tới kỳ thi → mỗi loại bài chia đều: quota = ⌈số bài còn lại lúc đầu ngày ÷ số ngày còn lại⌉.
// Hôm nay học chưa hết thì ngày mai số bài còn lại lại chia cho số ngày còn lại mới (snapshot lấy lại mỗi ngày, lưu trong prefs.plan).
// Loại bài: mẫu ngữ pháp N4–N3 (xong = mọi câu luyện của mẫu đã đúng ít nhất 1 lần) · nhóm 10 từ N3 (xong = mọi từ đã đúng 1 lần)
//           · phần đề luyện (chỉ có trên máy, xem core/exams.js; xong = đã nộp bài).
// Mỗi ngày bắt buộc thêm 1 lượt ôn ngữ pháp + 1 lượt ôn từ mới (ưu tiên lỗi sai, rồi mục lâu chưa gặp).
// Routes: #/plan · #/plan/v/<k> luyện nhóm từ thứ k của hôm nay · #/plan/rg ôn ngữ pháp · #/plan/rv ôn từ mới
import { $, esc, icon, color, pct, today } from '../core/util.js';
import { DB, daysLeft } from '../core/data.js';
import { progress, prefs, savePrefs } from '../core/store.js';
import { register, go } from '../core/router.js';
import { round } from '../core/quiz.js';
import { pageHead, bar, lvTag } from '../core/ui.js';
import { vocabQ } from './vocab.js';
import { grammarQ } from './practice.js';
import { EXAMS, loadExams, partKey } from '../core/exams.js';

const CHUNK = 10, GLV = ['N4', 'N3'];
const seen = id => progress.r[id] && progress.r[id].c > 0;
const KIND = { g: 'Ngữ pháp', v: 'Từ mới', e: 'Đề luyện' };

// ---- all units in study order
function gUnits() {
  return DB.grammar.filter(g => GLV.includes(g.lv) && g.q.length)
    .sort((a, b) => GLV.indexOf(a.lv) - GLV.indexOf(b.lv) || +a.id.slice(1) - +b.id.slice(1))
    .map(g => ({ id: g.id, k: 'g', title: g.p, sub: g.mean, lv: g.lv, href: '#/more/grammar/p/' + g.id, ids: g.q.map((q, i) => g.id + '.' + i) }));
}
function vUnits() {
  const order = Object.fromEntries(DB.topics.map((t, i) => [t.id, i]));
  const words = DB.vocab.filter(v => v.lv === 'N3').sort((a, b) => (order[a.t] ?? 99) - (order[b.t] ?? 99) || +a.id.slice(1) - +b.id.slice(1));
  const out = [];
  for (let i = 0; i < words.length; i += CHUNK) {
    const ws = words.slice(i, i + CHUNK);
    out.push({ id: 'vc:' + ws[0].id, k: 'v', title: ws.map(w => w.w).slice(0, 4).join('・') + '…', sub: (DB.topicName[ws[0].t] || '') + ' · ' + ws.length + ' từ', ids: ws.map(w => w.id) });
  }
  return out;
}
function eUnits() {
  return EXAMS.flatMap(e => e.parts.map(p => ({ id: partKey(e, p), k: 'e', title: e.title, sub: p.name, href: '#/more/exam/' + e.id + '/' + p.id, ids: [] })));
}
const unitDone = u => u.k === 'e' ? !!progress.r[u.id] : u.ids.every(seen);

// ---- today's snapshot (made once per day; exam units added when the local exams finish loading)
function snapshot() {
  const day = today(), days = Math.max(1, daysLeft());
  let P = prefs.plan;
  const fill = (k, units) => {
    const pend = units.filter(u => !unitDone(u)), quota = Math.ceil(pend.length / days);
    P.rem[k] = pend.length; P.quota[k] = quota; P.ids[k] = pend.slice(0, quota).map(u => u.id);
  };
  if (!P || P.day !== day) {
    P = prefs.plan = { day, days, rem: {}, quota: {}, ids: {}, rev: { g: 0, v: 0 }, ex: false };
    fill('g', gUnits()); fill('v', vUnits());
  }
  if (!P.ex && EXAMS.length) { fill('e', eUnits()); P.ex = true; }
  savePrefs();
  return P;
}

function unitRow(u, k) {
  const done = unitDone(u), n = u.ids.filter(seen).length;
  const href = u.k === 'v' ? '#/plan/v/' + k : u.href;
  return `<a class="wrow plan-row${done ? ' done' : ''}" href="${href}"><span class="pchk">${done ? icon('check') : ''}</span>
    <span class="jp"><b>${esc(u.title)}</b></span>${u.lv ? lvTag(u.lv) : ''}<span class="small muted">${esc(u.sub || '')}${u.ids.length && !done ? ` · ${n}/${u.ids.length}` : ''}</span></a>`;
}

function page(main) {
  const P = snapshot(), d = daysLeft();
  const all = { g: gUnits(), v: vUnits(), e: eUnits() };
  const byId = k => Object.fromEntries(all[k].map(u => [u.id, u]));
  const blocks = ['g', 'v', 'e'].filter(k => P.ids[k] && (P.rem[k] || k !== 'e')).map(k => {
    const map = byId(k), list = (P.ids[k] || []).map(id => map[id]).filter(Boolean), doneN = list.filter(unitDone).length;
    const left = all[k].filter(u => !unitDone(u)).length;
    const extra = doneN === list.length ? all[k].filter(u => !unitDone(u) && !P.ids[k].includes(u.id)).slice(0, 1) : [];
    return `<div class="card" style="${color(k === 'g' ? 'grammar' : k === 'v' ? 'vocab' : 'exam')}">
      <div class="plan-head"><h2>${KIND[k]}</h2><span class="small muted">Hôm nay ${doneN}/${list.length} bài · còn ${left}/${all[k].length} bài cả khoá</span></div>
      <p class="small muted">${P.rem[k]} bài còn lại ÷ ${P.days} ngày = ${P.quota[k]} bài/ngày${k === 'v' ? ' (mỗi bài 10 từ N3)' : k === 'g' ? ' (mẫu N4–N3; xong khi mọi câu luyện của mẫu đã đúng ít nhất 1 lần)' : ''}</p>
      ${bar(pct(doneN, list.length))}
      <div class="wlist">${list.map((u, i) => unitRow(u, i)).join('') || '<p class="small">Đã học hết loại bài này. Tuyệt vời!</p>'}</div>
      ${extra.length ? `<p class="small muted" style="margin-top:8px">Xong phần hôm nay rồi. Muốn học thêm thì làm bài kế tiếp (sẽ được trừ vào ngày mai):</p><div class="wlist">${extra.map(u => unitRow(u, -1)).join('')}</div>` : ''}
    </div>`;
  });
  const rv = P.rev || { g: 0, v: 0 };
  const revCard = `<div class="card" style="${color('plan')}"><div class="plan-head"><h2>Ôn tập bắt buộc mỗi ngày</h2></div>
    <p class="small muted">Mỗi ngày 1 lượt 10 câu ngữ pháp và 1 lượt 10 câu từ mới, ưu tiên câu đã sai và câu lâu chưa gặp.</p>
    <div class="wlist">
      <a class="wrow plan-row${rv.g ? ' done' : ''}" href="#/plan/rg"><span class="pchk">${rv.g ? icon('check') : ''}</span><b>Ôn ngữ pháp</b><span class="small muted">${rv.g ? 'đã ôn ' + rv.g + ' lượt' : 'chưa ôn hôm nay'}</span></a>
      <a class="wrow plan-row${rv.v ? ' done' : ''}" href="#/plan/rv"><span class="pchk">${rv.v ? icon('check') : ''}</span><b>Ôn từ mới</b><span class="small muted">${rv.v ? 'đã ôn ' + rv.v + ' lượt' : 'chưa ôn hôm nay'}</span></a>
    </div></div>`;
  main.innerHTML = pageHead('plan', 'Kế hoạch hôm nay', `${d > 0 ? 'Còn ' + d + ' ngày tới kỳ thi (' + DB.manifest.exam.split('-').reverse().join('/') + ')' : 'Hôm nay là ngày thi hoặc kỳ thi đã qua'} · số bài mỗi ngày tính lại mỗi sáng từ số bài còn lại`) +
    revCard + blocks.join('') +
    (EXAMS.length ? '' : '<p class="small muted">Đề luyện chỉ có khi chạy trang trên máy (thư mục local/exams), nên không tính vào kế hoạch ở đây.</p>');
}

// ---- review pools: mistakes first, then items seen longest ago; before anything is seen, today's planned items
function reviewPool(items, idOf) {
  const seenItems = items.filter(x => progress.r[idOf(x)]);
  if (!seenItems.length) return items.slice(0, 40);
  const score = x => { const id = idOf(x), r = progress.r[id]; return (progress.m[id] ? 0 : 1e13) + (r.t || 0); };
  return seenItems.sort((a, b) => score(a) - score(b)).slice(0, 40);
}
function drill(main, title, sec, gen, size, onDone) {
  main.innerHTML = pageHead('plan', title, '', ['Kế hoạch hôm nay', '#/plan']) + `<div class="stage" style="${color(sec)}"></div>`;
  round($('.stage', main), sec, gen, { size, back: ['Kế hoạch hôm nay', '#/plan'], onDone });
}
const tick = k => { const P = snapshot(); P.rev[k] = (P.rev[k] || 0) + 1; savePrefs(); };

register({
  id: 'plan', name: 'Hôm nay', icon: 'plan', order: 1,
  tile: { sub: 'Bài cần học hôm nay + ôn tập', stat: () => { const P = prefs.plan && prefs.plan.day === today() ? prefs.plan : null;
    if (!P) return null; const n = ['g', 'v', 'e'].reduce((s, k) => s + (P.ids[k] || []).length, 0);
    const all = [...gUnits(), ...vUnits(), ...eUnits()], set = new Set(['g', 'v', 'e'].flatMap(k => P.ids[k] || []));
    return [all.filter(u => set.has(u.id) && unitDone(u)).length, n]; } },
  render(main, [sub, k]) {
    if (!EXAMS.length) loadExams().then(xs => { if (xs.length && location.hash.replace(/\/$/, '') === '#/plan') page(main); });
    if (sub === 'v') {
      const P = snapshot(), map = Object.fromEntries(vUnits().map(u => [u.id, u]));
      let u = map[(P.ids.v || [])[+k]];
      if (+k < 0 || !u) u = vUnits().find(x => !unitDone(x));
      if (!u) return go('plan');
      const words = u.ids.map(id => DB.vById[id]);
      return drill(main, 'Từ mới: ' + u.title, 'vocab', () => { const left = words.filter(w => !seen(w.id)); return vocabQ(prefs.planVMode || 'mean', left.length ? left : words, 'plan|' + u.id); }, CHUNK);
    }
    if (sub === 'rg') {
      const pool = reviewPool(DB.gq.filter(x => GLV.includes(x.g.lv)), x => x.id);
      return drill(main, 'Ôn ngữ pháp hôm nay', 'grammar', () => grammarQ(pool, 'plan-rg|' + today()), 10, () => tick('g'));
    }
    if (sub === 'rv') {
      const pool = reviewPool(DB.vocab.filter(v => v.lv === 'N3' || progress.r[v.id]), v => v.id);
      return drill(main, 'Ôn từ mới hôm nay', 'vocab', () => vocabQ('mean', pool, 'plan-rv|' + today()), 10, () => tick('v'));
    }
    page(main);
  }
});
