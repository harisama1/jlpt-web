// Section registry + hash router.  URL = #/<section>/<param>/<param>…  (e.g. #/vocab/N3/2.1, #/kanji/N4/k12, #/more/read)
// A section module calls register({...}) once; main.js imports the module. Fields:
//   id, name, icon, color (css var name), parent ('' = top level, 'more' = inside "Mục khác"), order,
//   tile: {sub, stat()} to show a card on its parent page, soon: true = shown but disabled ("phát triển sau"),
//   render(main, params) — draws the page.
export const SECTIONS = [];
export const register = s => { SECTIONS.push(Object.assign({ parent: '', order: 50, color: s.id }, s)); SECTIONS.sort((a, b) => a.order - b.order); };
export const section = id => SECTIONS.find(s => s.id === id);
export const children = parent => SECTIONS.filter(s => s.parent === parent && s.id !== parent);

let onRoute = () => { };
export const setRenderer = fn => { onRoute = fn; };
export function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { id: parts[0] || 'home', params: parts.slice(1) };
}
export function go(path) {
  const h = '#/' + String(path).replace(/^#?\/?/, '');
  if (location.hash === h) onRoute(); else location.hash = h;
}
window.addEventListener('hashchange', () => onRoute());
