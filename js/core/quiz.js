// Quiz engine shared by every section.
// A question is a plain object: {id, sec, label, tag, prompt(html), ask, opts[], answer(index), jp, say, sayAfter,
//   full (sentence with the answer filled in), vi (translation), why, notes[] (meaning of each option), info(html)}.
// round(el, sec, gen) asks `size` questions from gen(), shows feedback + explanation, then a result card.
import { $, $$, esc, shuffle, icon, color } from './util.js';
import { record } from './store.js';
import { speakBtn } from './speech.js';
import { go } from './router.js';

export const ROUND = 10;
let KEYS = null;
document.addEventListener('keydown', e => { if (KEYS) KEYS(e); });
export const releaseKeys = () => { KEYS = null; };

const MORE = { grammar: 'mẫu ngữ pháp', kanji: 'chữ Kanji' };
export function explainHTML(q, chosen, order = q.opts.map((o, i) => i)) {
  const rows = order.map((i, k) => {
    const o = q.opts[i], cls = i === q.answer ? 'right' : i === chosen ? 'wrong' : '';
    const mark = i === q.answer ? '<span class="xm ok">Đáp án đúng</span>' : i === chosen ? '<span class="xm bad">Bạn chọn</span>' : '';
    const note = q.notes && q.notes[i] ? esc(q.notes[i]) : '<span class="muted">—</span>';
    return `<li class="${cls}"><span class="xo${q.jp ? ' jp' : ''}"><span class="xk">${k + 1}</span>${esc(o)}</span><span class="xn">${note}</span>${mark}</li>`;
  }).join('');
  return `<div class="explain">
    ${q.full || q.vi ? `<div class="xsec"><div class="xt">Dịch nghĩa</div>${q.full ? `<div class="jp">${esc(q.full)} ${speakBtn(q.full)}</div>` : ''}${q.vi ? `<div>${esc(q.vi)}</div>` : ''}</div>` : ''}
    <div class="xsec"><div class="xt">Giải thích</div>${q.why ? `<div>${esc(q.why)}</div>` : ''}<ul class="xlist">${rows}</ul></div>
    ${q.info ? `<details class="xsec more"><summary>Xem thêm về ${MORE[q.sec] || 'từ này'}</summary><div class="info">${q.info}</div></details>` : ''}
  </div>`;
}

export function round(el, sec, gen, opts = {}) {
  const st = { i: 0, ok: 0, wrong: [] }, size = opts.size || ROUND;
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
      <div class="fb" hidden></div></div>`;
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
    const p = Math.round(100 * st.ok / size);
    const msg = p === 100 ? 'Tuyệt vời, không sai câu nào!' : p >= 80 ? 'Rất tốt! Ôn lại vài câu sai là ổn.' : p >= 50 ? 'Khá rồi, cố thêm chút nữa.' : 'Đừng nản, các câu sai đã được lưu để ôn lại.';
    el.innerHTML = `<div class="card result" style="${color(sec)}"><div class="muted small">Kết quả lượt này</div><div class="score">${st.ok}/${size}</div><div><b>${msg}</b></div>
      ${st.wrong.length ? `<ul>${st.wrong.map(w => `<li><span class="jp">${esc(w.label)}</span><br><span class="small muted">Đáp án: </span><span class="jp">${esc(w.a)}</span></li>`).join('')}</ul>` : ''}
      <div class="row"><button type="button" class="btn c again">Lượt mới</button>${st.wrong.length && sec !== 'miss' ? '<button type="button" class="btn sec tomiss">Ôn lỗi sai</button>' : ''}${opts.back ? `<button type="button" class="btn sec goback">${esc(opts.back[0])}</button>` : ''}</div></div>`;
    $('.again', el).onclick = () => round(el, sec, gen, opts);
    const tm = $('.tomiss', el); if (tm) tm.onclick = () => go('more/miss');
    const gb = $('.goback', el); if (gb) gb.onclick = () => go(opts.back[1]);
    $('.again', el).focus({ preventScroll: true });
  }
  ask();
}
