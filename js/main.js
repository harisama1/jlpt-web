// Entry point: load data, register sections, draw navigation, route.
// To add a feature: create js/sections/<name>.js that calls register({...}) and import it below.
import { $, $$, esc, icon, color } from './core/util.js';
import { DB, loadData, daysLeft } from './core/data.js';
import { progress, onProgress } from './core/store.js';
import { SECTIONS, children, section, parse, setRenderer } from './core/router.js';
import { releaseKeys } from './core/quiz.js';
import './sections/home.js';
import './sections/vocab.js';
import './sections/kanji.js';
import './sections/practice.js';
import './sections/reading.js';
import { applyTheme } from './sections/review.js';

const navItems = () => [section('home'), ...children('').filter(s => s.tile)];

function buildNav() {
  const link = s => `<a href="#/${s.id}" data-nav="${s.id}" style="${color(s.color)}">${icon(s.icon)}<span>${esc(s.name)}</span>${s.id === 'more' ? '<span class="dot" data-badge></span>' : ''}</a>`;
  $('#sideLinks').innerHTML = navItems().map(link).join('');
  $('#bottomNav').innerHTML = navItems().map(link).join('');
}
function badges() {
  const n = Object.keys(progress.m).length;
  $$('[data-badge]').forEach(el => el.textContent = n ? (n > 99 ? '99+' : n) : '');
}

function render() {
  releaseKeys();
  const { id, params } = parse(), main = $('#main');
  let s = section(id) || section('home'), p = params;
  const sub = p[0] && children(s.id).find(c => c.id === p[0]);
  if (sub) { s = sub; p = p.slice(1); }
  const top = s.parent || s.id;
  $$('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === top ? 'page' : 'false'));
  s.render(main, p);
  const d = daysLeft(), txt = d > 0 ? 'Còn ' + d + ' ngày' : '';
  $('#topCount').textContent = txt; $('#sideCount').textContent = txt;
  window.scrollTo(0, 0);
}

applyTheme();
loadData().then(() => {
  buildNav(); badges(); onProgress(badges);
  setRenderer(render); render();
}).catch(err => {
  $('#main').innerHTML = `<div class="empty">Không tải được dữ liệu (${esc(err.message)}). Nếu bạn mở file trực tiếp trên máy, hãy chạy <code>python3 -m http.server</code> trong thư mục này rồi mở <code>http://localhost:8000</code>.</div>`;
});
export { SECTIONS, DB };
