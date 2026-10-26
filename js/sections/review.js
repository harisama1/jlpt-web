// Lỗi sai (#/more/miss[/phần]), Ôn nhanh (#/more/mix), Giao diện + sao lưu (#/more/settings).
import { $, $$, esc, pick, today, icon, color } from '../core/util.js';
import { DB } from '../core/data.js';
import { progress, prefs, savePrefs, saveProgress, replaceProgress } from '../core/store.js';
import { register, section, go } from '../core/router.js';
import { round, ROUND } from '../core/quiz.js';
import { pageHead, seg } from '../core/ui.js';
import { sync, connect, disconnect, now as syncNow, connected } from '../core/sync.js';
import { vocabQ } from './vocab.js';
import { kanjiQ } from './kanji.js';
import { grammarQ, sentQ, synQ } from './practice.js';

const REVIEW = {
  vocab: ids => vocabQ('mean', ids.map(i => DB.vById[i]).filter(Boolean), 'miss|v'),
  kanji: ids => kanjiQ('hv', ids.map(i => DB.kById[i]).filter(Boolean), 'miss|k'),
  grammar: ids => grammarQ(ids.map(i => DB.gqById[i]).filter(Boolean), 'miss|g'),
  sent: ids => sentQ(ids.map(i => DB.sById[i]).filter(Boolean), 'miss|s'),
  syn: ids => synQ(ids.map(i => DB.yById[i]).filter(Boolean), 'miss|y') };

register({
  id: 'miss', name: 'Lỗi sai', icon: 'miss', parent: 'more', order: 70, tile: { sub: 'Ôn lại câu đã trả lời sai', badge: () => Object.keys(progress.m).length },
  render(main, [sec]) {
    const by = {};
    Object.entries(progress.m).forEach(([id, m]) => (by[m.sec] = by[m.sec] || []).push([id, m]));
    if (sec && by[sec] && REVIEW[sec]) {
      main.innerHTML = pageHead('miss', 'Ôn lỗi sai · ' + ((section(sec) || {}).name || sec), 'Trả lời đúng 2 lần liên tiếp thì câu đó được xoá khỏi sổ', ['Sổ lỗi sai', '#/more/miss']) + '<div class="stage"></div>';
      const ids = () => Object.keys(progress.m).filter(id => progress.m[id].sec === sec);
      return round($('.stage', main), 'miss', () => { const l = ids(); return l.length ? REVIEW[sec](l) : null; }, { size: Math.min(ROUND, Math.max(1, ids().length)), back: ['Sổ lỗi sai', '#/more/miss'] });
    }
    const total = Object.keys(progress.m).length;
    main.innerHTML = pageHead('miss', 'Sổ lỗi sai', total ? total + ' câu cần ôn lại' : 'Câu nào trả lời sai sẽ được lưu ở đây', ['Mục khác', '#/more']) +
      (total ? '' : '<div class="empty">Chưa có lỗi sai nào. Làm vài lượt ôn, câu sai sẽ hiện ở đây.</div>') +
      Object.entries(by).map(([s, list]) => { const S = section(s) || { name: s, icon: 'more' };
        return `<div class="card" style="${color(s)}"><div class="page-head"><span class="badge-ic">${icon(S.icon)}</span><div><h2>${esc(S.name)}</h2><p>${list.length} câu</p></div></div>
        <div class="wlist" style="margin:10px 0">${list.sort((a, b) => b[1].n - a[1].n).slice(0, 30).map(([id, m]) => `<div class="wrow"><span class="jp">${esc((m.label || id).split(' — ')[0])}</span><span class="small">${esc((m.label || '').split(' — ')[1] || '')} <span class="muted">· sai ${m.n} lần</span></span></div>`).join('')}</div>
        ${REVIEW[s] ? `<a class="btn c" href="#/more/miss/${s}">Ôn lại phần này</a>` : '<p class="small muted">Mở lại bài trong mục Đọc hiểu để làm lại.</p>'}</div>`; }).join('');
  }
});

register({
  id: 'mix', name: 'Ôn nhanh', icon: 'bolt', parent: 'more', order: 71, color: 'home', tile: { sub: '10 câu trộn từ mọi phần' },
  render(main) {
    main.innerHTML = pageHead('mix', 'Ôn nhanh', '10 câu trộn từ tất cả các phần', ['Trang chủ', '#/home']) + `<div class="stage" style="${color('home')}"></div>`;
    const gens = [() => vocabQ('mean', DB.vocab, 'mix|v'), () => vocabQ('read', DB.vocab, 'mix|vr'), () => kanjiQ('hv', DB.kanji, 'mix|k'), () => kanjiQ('word', DB.kanji, 'mix|kw'),
      () => grammarQ(DB.gq, 'mix|g'), () => synQ(DB.synonyms, 'mix|y'), () => sentQ(DB.sentences, 'mix|s')];
    round($('.stage', main), 'home', () => pick(gens)());
  }
});

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=jlpt-web-sync';
function syncHTML() {
  if (connected()) return `<p class="small">Đã kết nối. Tiến độ tự đồng bộ khi mở trang và vài giây sau mỗi câu trả lời.</p>
    <p class="small muted">Lần đồng bộ gần nhất: ${sync.last ? new Date(sync.last).toLocaleString('vi-VN') : 'chưa'}${sync.err ? ` · <span style="color:var(--bad)">Lỗi: ${esc(sync.err)}</span>` : ''}</p>
    <div class="row"><button type="button" class="btn c" id="syncNow">Đồng bộ ngay</button><button type="button" class="btn sec" id="syncOff">Ngắt kết nối trên máy này</button></div>`;
  return `<p class="small muted">Tiến độ được lưu vào một Gist bí mật trên GitHub của bạn, mọi thiết bị dùng chung. Làm một lần trên mỗi thiết bị:</p>
    <ol class="small"><li>Mở <a href="${TOKEN_URL}" target="_blank" rel="noopener">trang tạo token GitHub</a> (đã chọn sẵn quyền <b>gist</b>), chọn thời hạn, bấm <b>Generate token</b>, chép token.</li>
    <li>Dán token vào ô dưới rồi bấm Kết nối. Thiết bị thứ hai dùng cùng token (hoặc token khác của cùng tài khoản) sẽ tự nhận đúng Gist.</li></ol>
    <label class="field"><span class="flabel">Token GitHub (chỉ quyền gist)</span><input type="password" id="syncToken" autocomplete="off" placeholder="ghp_…"></label>
    <div class="row" style="margin-top:10px"><button type="button" class="btn c" id="syncOn">Kết nối</button></div>
    <p class="small muted">Token chỉ lưu trong trình duyệt của thiết bị này. Đừng dùng token có quyền khác ngoài gist.</p>${sync.err ? `<p class="small" style="color:var(--bad)">Lỗi: ${esc(sync.err)}</p>` : ''}`;
}
function bindSync(main, redraw) {
  const msg = t => { const c = $('#syncCard', main); c.insertAdjacentHTML('beforeend', `<p class="small">${esc(t)}</p>`); };
  const on = $('#syncOn', main), nowB = $('#syncNow', main), off = $('#syncOff', main);
  if (on) on.onclick = async () => { const t = $('#syncToken', main).value; if (!t.trim()) return;
    on.disabled = true; msg('Đang kết nối…'); try { await connect(t); } catch (e) { sync.err = e.message; } redraw(); };
  if (nowB) nowB.onclick = async () => { nowB.disabled = true; await syncNow(); redraw(); };
  if (off) off.onclick = () => { disconnect(); redraw(); };
}

export const ACCENTS = [['indigo', 'Chàm'], ['sakura', 'Hoa anh đào'], ['matcha', 'Trà xanh'], ['ocean', 'Biển'], ['sunset', 'Hoàng hôn']];
export function applyTheme() {
  const r = document.documentElement;
  if (prefs.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', prefs.theme);
  r.setAttribute('data-accent', prefs.accent || 'indigo');
}
register({
  id: 'settings', name: 'Giao diện & sao lưu', icon: 'gear', parent: 'more', order: 80, color: 'more', tile: { sub: 'Sáng/tối, màu, xuất/nhập tiến độ' },
  render(main) {
    main.innerHTML = pageHead('settings', 'Giao diện & sao lưu', '', ['Mục khác', '#/more']) +
      `<div class="card"><h2>Giao diện</h2><div class="flabel" style="margin-top:10px">Chế độ</div>${seg('theme', [['auto', 'Theo máy'], ['light', 'Sáng'], ['dark', 'Tối']], prefs.theme)}
      <div class="flabel" style="margin-top:14px">Màu chủ đạo</div><div class="swatches">${ACCENTS.map(([id, n]) => `<button type="button" class="swatch" data-accent="${id}" aria-pressed="${prefs.accent === id}"><i class="sw-${id}"></i>${esc(n)}</button>`).join('')}</div></div>
      <div class="card" id="syncCard"><h2>Đồng bộ nhiều thiết bị</h2>${syncHTML()}</div>
      <div class="card"><h2>Sao lưu tiến độ</h2><p class="small muted">Tiến độ lưu trong trình duyệt này. Xuất ra file JSON để giữ lại hoặc chuyển sang máy khác.</p>
      <div class="row"><button type="button" class="btn sec" id="exp">Xuất file JSON</button><label class="btn sec" for="imp">Nhập file JSON</label><input type="file" id="imp" accept="application/json,.json" hidden>
      <button type="button" class="btn danger" id="clr">Xoá sổ lỗi sai</button></div><p id="msg" class="small"></p></div>`;
    bindSync(main, () => this.render(main));
    $$('[data-k="theme"]', main).forEach(b => b.onclick = () => { prefs.theme = b.dataset.v; savePrefs(); applyTheme(); this.render(main); });
    $$('[data-accent]', main).forEach(b => b.onclick = () => { prefs.accent = b.dataset.accent; savePrefs(); applyTheme(); this.render(main); });
    $('#exp', main).onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 1)], { type: 'application/json' }));
      a.download = 'jlpt-tien-do-' + today() + '.json'; a.click(); $('#msg', main).textContent = 'Đã tạo file tiến độ.';
    };
    $('#imp', main).onchange = e => { const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { replaceProgress(JSON.parse(t)); $('#msg', main).textContent = 'Đã nhập tiến độ.'; }).catch(() => { $('#msg', main).textContent = 'File không đúng định dạng tiến độ của trang này.'; }); };
    let armed = false;
    $('#clr', main).onclick = e => { if (!armed) { armed = true; e.currentTarget.textContent = 'Bấm lần nữa để xoá'; return; } progress.m = {}; saveProgress(); go('more/miss'); };
  }
});
