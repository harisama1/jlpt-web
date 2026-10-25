// Đọc hiểu: #/more/read = danh sách bài · #/more/read/<id> = bài đọc, điền chỗ trống + câu hỏi, có dịch và giải thích.
// Nghe hiểu: #/more/listen — chỗ dành sẵn cho phần sẽ phát triển sau.
import { $, $$, esc, shuffle, color } from '../core/util.js';
import { DB, meanOf } from '../core/data.js';
import { progress, record, saveProgress, countLearned } from '../core/store.js';
import { register } from '../core/router.js';
import { speakBtn } from '../core/speech.js';
import { pageHead } from '../core/ui.js';

function list(main) {
  main.innerHTML = pageHead('read', 'Đọc hiểu', 'Điền chỗ trống kiểu 文章の文法 rồi trả lời câu hỏi nội dung', ['Mục khác', '#/more']) +
    `<div class="rlist" style="${color('read')}">${DB.reading.map(r => { const res = progress.r[r.id], tot = r.blanks.length + r.questions.length;
      return `<a class="tile" href="#/more/read/${r.id}"><span class="chipnum">${res ? 'Đúng ' + (res.best ?? 0) + '/' + tot : 'Chưa làm'}</span><b>${esc(r.title)}</b><span class="sub">${esc(r.type)} · ${tot} câu</span></a>`; }).join('')}</div>`;
}

function passage(main, p) {
  const items = [...p.blanks.map((b, i) => ({ id: p.id + '#b' + (i + 1), kind: 'blank', n: i + 1, q: 'Chỗ trống 【' + (i + 1) + '】', a: b.a, d: b.d, why: b.why })),
    ...p.questions.map((q, i) => ({ id: p.id + '#q' + (i + 1), kind: 'q', q: q.q, a: q.a, d: q.d, vi: q.vi, avi: q.avi, dvi: q.dvi, why: q.why }))];
  const answers = {};
  const text = esc(p.text).replace(/【(\d)】/g, (m, n) => `<span class="blank" id="bl${n}">【${n}】</span>`);
  main.innerHTML = pageHead('read', p.title, p.type, ['Danh sách bài', '#/more/read']) +
    `<div class="rgrid" style="${color('read')}"><div class="card passage">${text}<div style="margin-top:10px">${speakBtn(p.text.replace(/【\d】/g, '…'))}</div>
    ${p.vi ? `<details class="xsec more" style="margin-top:12px"><summary>Xem bản dịch đoạn văn</summary><div class="rvi">${esc(p.vi).replace(/\n/g, '<br>')}</div></details>` : ''}</div><div class="rqs">
    ${items.map((it, k) => `<div class="card rq" data-k="${k}"><div class="rq-title${it.kind === 'q' ? ' jp' : ''}">${esc(it.q)}</div>
      <div class="opts">${shuffle([it.a, ...it.d]).map(o => `<button type="button" class="opt jp" data-v="${esc(o)}"><span>${esc(o)}</span></button>`).join('')}</div></div>`).join('')}
    <div id="readScore"></div></div></div>`;
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
        const r = progress.r[p.id] || (progress.r[p.id] = { c: 0, w: 0, s: 0 });
        r.best = Math.max(r.best || 0, sc); r.s = sc === items.length ? 2 : 0; saveProgress();
        $('#readScore', main).innerHTML = `<div class="card result" style="${color('read')}"><div class="score">${sc}/${items.length}</div><div class="row"><a class="btn c" href="#/more/read/${p.id}?${Date.now()}">Làm lại bài này</a><a class="btn sec" href="#/more/read">Bài khác</a></div></div>`;
      }
    });
  });
}

register({
  id: 'read', name: 'Đọc hiểu', icon: 'read', parent: 'more', order: 60, tile: { sub: 'Đoạn văn + câu hỏi, có bản dịch', stat: () => [countLearned(DB.reading.map(r => r.id)), DB.reading.length] },
  render(main, [id]) {
    const p = id && DB.reading.find(r => r.id === id.split('?')[0]);
    p ? passage(main, p) : list(main);
  }
});

register({
  id: 'listen', name: 'Nghe hiểu', icon: 'listen', parent: 'more', order: 63, soon: true, tile: { sub: 'Phát triển trong tương lai' },
  render(main) {
    main.innerHTML = pageHead('listen', 'Nghe hiểu', 'Phần này sẽ được phát triển sau', ['Mục khác', '#/more']) +
      '<div class="empty">Chưa có bài nghe. Khi có dữ liệu, thêm file vào data/ và khai báo trong manifest.json là phần này dùng được.</div>';
  }
});
