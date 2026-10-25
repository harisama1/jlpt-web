// Trang chủ (theo JLPT_Design.drawio): số ngày còn lại · tiến độ đã làm / tổng · 4 ô Từ mới, Kanji, Mẫu câu, Mục khác.
// Mục khác (#/more): thẻ của mọi section có parent 'more'; section soon: true hiện mờ "phát triển sau".
import { esc, icon, color, pct, today } from '../core/util.js';
import { DB, daysLeft } from '../core/data.js';
import { progress, countLearned } from '../core/store.js';
import { register, children } from '../core/router.js';
import { pageHead, bar } from '../core/ui.js';

const DAILY_GOAL = 40;
const statOf = s => s.tile && s.tile.stat ? s.tile.stat() : null;

export function tile(s, href) {
  const st = statOf(s), badge = s.tile && s.tile.badge ? s.tile.badge() : 0;
  const body = `<div class="tile-top"><span class="badge-ic">${icon(s.icon)}</span><div><b>${esc(s.name)}</b><span class="sub">${esc((s.tile && s.tile.sub) || '')}</span></div>${badge ? `<span class="dot">${badge}</span>` : ''}</div>
    ${st ? bar(pct(st[0], st[1])) + `<div class="stats-row"><span>Đã thuộc ${st[0]}/${st[1]}</span><span>${pct(st[0], st[1])}%</span></div>` : ''}`;
  return s.soon ? `<div class="tile disabled" style="${color(s.color)}">${body}<span class="soon">Sắp có</span></div>` : `<a class="tile" href="${href}" style="${color(s.color)}">${body}</a>`;
}

// every learnable id across sections (for the overall progress bar)
function overall() {
  const ids = [...DB.vocab, ...DB.kanji, ...DB.gq, ...DB.sentences, ...DB.synonyms, ...DB.reading].map(x => x.id);
  return [countLearned(ids), ids.length];
}

register({
  id: 'home', name: 'Trang chủ', icon: 'home', order: 0,
  render(main) {
    const d = daysLeft(), span = Math.round((new Date(DB.manifest.exam) - new Date(DB.manifest.start)) / 86400000), ring = Math.max(0, Math.min(100, Math.round(100 * (span - d) / span)));
    const t = progress.day[today()] || { n: 0, ok: 0 }, [done, total] = overall(), missN = Object.keys(progress.m).length;
    const tops = children('').filter(s => s.tile);
    main.innerHTML = `<section class="hero">
        <div class="ring" style="--p:${ring}"><div><span class="big">${Math.max(d, 0)}</span><small>ngày nữa</small></div></div>
        <div class="hero-text"><h1>${d > 0 ? 'Cố lên, sắp đến kỳ thi JLPT!' : d === 0 ? 'Hôm nay là ngày thi. Chúc bạn đỗ!' : 'Kỳ thi đã qua'}</h1>
          <p>Ngày thi ${DB.manifest.exam.split('-').reverse().join('/')} · hôm nay đã làm ${t.n}/${DAILY_GOAL} câu</p>
          <div class="row"><a class="btn" href="#/more/mix">${icon('bolt')} Ôn nhanh 10 câu</a>${missN ? `<a class="btn ghost" href="#/more/miss">Ôn ${missN} lỗi sai</a>` : ''}</div></div>
      </section>
      <div class="card goal" style="${color('home')}"><div><b>Tiến độ toàn khoá</b><div class="small muted">Đã thuộc ${done}/${total} mục (${pct(done, total)}%) · một mục "đã thuộc" khi đúng 2 lần liên tiếp</div></div>${bar(pct(done, total))}</div>
      <div class="tiles four">${tops.map(s => tile(s, '#/' + s.id)).join('')}</div>`;
  }
});

register({
  id: 'more', name: 'Mục khác', icon: 'more', order: 40, tile: { sub: 'Đọc hiểu, đồng nghĩa, ngữ pháp, nghe hiểu…' },
  render(main) {
    main.innerHTML = pageHead('more', 'Mục khác', 'Các phần ôn tập khác') + `<div class="tiles">${children('more').map(s => tile(s, '#/more/' + s.id)).join('')}</div>`;
  }
});
