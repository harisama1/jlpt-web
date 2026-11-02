// Luyện đề (#/more/exam): đề luyện chỉ có trên máy (local/exams, xem core/exams.js).
// #/more/exam = danh sách đề · #/more/exam/<đề>/<phần> = làm bài như đề thật (chọn hết rồi Nộp bài) → điểm, đáp án, giải thích, lời thoại bài nghe.
import { $, $$, esc, color, today } from '../core/util.js';
import { progress, saveProgress } from '../core/store.js';
import { register } from '../core/router.js';
import { pageHead, bar } from '../core/ui.js';
import { EXAMS, loadExams, partKey, partItems } from '../core/exams.js';

const media = (base, x) => [].concat(x || []).map(src => /\.(mp3|m4a|ogg|wav)(#|$)/i.test(src)
  ? `<audio controls preload="none" src="${esc(base + src)}"></audio>` : `<img class="ex-img" loading="lazy" src="${esc(base + src)}" alt="">`).join('');
const text = s => esc(s || '').replace(/［(.+?)］/g, '<u>$1</u>').replace(/\n/g, '<br>');

function list(main) {
  main.innerHTML = pageHead('exam', 'Luyện đề', 'Làm bài như đề thật, nộp bài để xem điểm, đáp án và lời thoại bài nghe', ['Mục khác', '#/more']) +
    (EXAMS.length ? EXAMS.map(e => `<div class="card" style="${color('exam')}"><h2>${esc(e.title)}</h2>${e.note ? `<p class="small muted">${esc(e.note)}</p>` : ''}
      <div class="wlist">${e.parts.map(p => { const r = progress.r[partKey(e, p)], n = partItems(p).filter(x => !x.missing).length;
        return `<a class="wrow" href="#/more/exam/${e.id}/${p.id}"><b>${esc(p.name)}</b><span class="small muted">${n} câu · ${r ? 'Lần tốt nhất ' + r.best + '/' + r.total : 'Chưa làm'}</span></a>`; }).join('')}</div></div>`).join('')
      : `<div class="empty">Chưa có đề luyện trên máy này. Đề luyện là tài liệu có bản quyền nên không đưa lên GitHub; chúng nằm trong thư mục <code>local/exams</code> và chỉ hiện khi chạy trang trên máy (<code>python3 -m http.server</code>).</div>`);
}

function sheet(main, e, p) {
  const items = partItems(p), base = e.base, chosen = {};
  main.innerHTML = pageHead('exam', p.name, esc(e.title), ['Danh sách đề', '#/more/exam']) +
    `<div style="${color('exam')}">${p.groups.map(g => `<div class="card ex-group">
      ${g.title ? `<div class="ex-title jp">${text(g.title)}</div>` : ''}${g.passage ? `<div class="passage jp">${text(g.passage)}</div>` : ''}${media(base, g.img)}${media(base, g.audio)}
      ${g.items.map(it => `<div class="ex-item" data-n="${it.n}"><div class="rq-title jp"><span class="exn">${it.n}</span>${text(it.q)}</div>${media(base, it.img)}${media(base, it.audio)}
        ${it.missing ? '<p class="small muted">Câu này chưa có nội dung (video không ghi lại).</p>' : `<div class="opts">${it.opts.map((o, i) => o === '-' ? '' : `<button type="button" class="opt jp" data-i="${i}"><span class="k">${i + 1}</span><span>${o === String(i + 1) ? '' : text(o)}</span></button>`).join('')}</div>`}
        <div class="ex-fb" hidden></div></div>`).join('')}</div>`).join('')}
      <div class="card ex-submit"><span class="small muted" id="exLeft"></span><button type="button" class="btn c" id="exGo">Nộp bài</button></div><div id="exRes"></div></div>`;
  const scored = items.filter(x => !x.missing), left = () => { $('#exLeft', main).textContent = `Đã chọn ${Object.keys(chosen).length}/${scored.length} câu`; };
  left();
  $$('.ex-item', main).forEach(box => $$('.opt', box).forEach(b => b.onclick = () => {
    if (main.dataset.done) return;
    $$('.opt', box).forEach(x => x.classList.toggle('picked', x === b)); chosen[box.dataset.n] = +b.dataset.i; left();
  }));
  $('#exGo', main).onclick = () => {
    if (Object.keys(chosen).length < scored.length && !confirm('Còn câu chưa chọn. Vẫn nộp bài?')) return;
    main.dataset.done = 1;
    let ok = 0;
    for (const it of scored) {
      const box = $(`.ex-item[data-n="${it.n}"]`, main), c = chosen[it.n], good = c === it.a; if (good) ok++;
      $$('.opt', box).forEach(x => { const i = +x.dataset.i; x.disabled = true; x.classList.remove('picked');
        if (i === it.a) x.classList.add('right'); else if (i === c) x.classList.add('wrong'); else x.classList.add('dim'); });
      const fb = $('.ex-fb', box); fb.hidden = false;
      fb.innerHTML = `<div class="explain"><div class="xsec"><div class="xt">${good ? 'Đúng' : c === undefined ? 'Chưa chọn' : 'Sai'} · đáp án ${it.a + 1}</div>${it.why ? `<div>${text(it.why)}</div>` : ''}${it.vi ? `<div class="small muted">${text(it.vi)}</div>` : ''}</div>
        ${it.script ? `<details class="xsec more"><summary>Lời thoại (chép bằng máy, có thể sai vài chữ)</summary><div class="jp small">${text(it.script)}</div></details>` : ''}</div>`;
    }
    const key = partKey(e, p), r = progress.r[key] || (progress.r[key] = { c: 0, w: 0, s: 0 });
    r.best = Math.max(r.best || 0, ok); r.total = scored.length; r.last = ok; r.day = today(); r.t = Date.now(); r.c++; saveProgress();
    $('#exRes', main).innerHTML = `<div class="card result"><div class="muted small">Kết quả</div><div class="score">${ok}/${scored.length}</div>${bar(Math.round(100 * ok / scored.length))}
      <div class="row"><a class="btn c" href="#/more/exam/${e.id}/${p.id}/${Date.now()}">Làm lại</a><a class="btn sec" href="#/plan">Kế hoạch hôm nay</a></div></div>`;
    $('#exRes', main).scrollIntoView({ behavior: 'smooth' });
  };
}

register({
  id: 'exam', name: 'Luyện đề', icon: 'exam', parent: 'more', order: 59, tile: { sub: 'Đề thi thử có chấm điểm (chỉ trên máy)' },
  render(main, [id, pid]) {
    delete main.dataset.done;
    main.innerHTML = '<div class="empty">Đang tải đề…</div>';
    const here = location.hash;
    loadExams().then(() => {
      if (location.hash !== here) return;                       // user moved on while the exams were loading
      const e = EXAMS.find(x => x.id === id), p = e && e.parts.find(x => x.id === pid);
      p ? sheet(main, e, p) : list(main);
    });
  }
});
