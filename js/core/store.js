// Everything kept in this browser (localStorage). Keys are the v1 keys, so earlier progress carries over.
//   progress.r[id] = {c, w, s}  right / wrong / current streak;  progress.m[id] = mistake;  progress.day[yyyy-mm-dd] = {n, ok}
//   prefs  = UI choices (theme, last level/topic per section…);  decks = no-repeat question order per scope
import { today } from './util.js';

const KEYS = { progress: 'jlpt-web-v1', prefs: 'jlpt-web-ui-v2', decks: 'jlpt-web-deck-v1' };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

export const progress = Object.assign({ r: {}, m: {}, day: {} }, load(KEYS.progress, {}));
export const prefs = Object.assign({ theme: 'auto', accent: 'indigo', level: 'N3', kLevel: 'N3', vMode: 'mean', kMode: 'hv', listQ: '' }, load(KEYS.prefs, {}));
export const decks = load(KEYS.decks, {});

export const saveProgress = () => write(KEYS.progress, progress);
export const savePrefs = () => write(KEYS.prefs, prefs);
export const saveDecks = () => write(KEYS.decks, decks);

const listeners = new Set();
export const onProgress = fn => listeners.add(fn);

export function record(id, sec, ok, label) {
  const r = progress.r[id] || (progress.r[id] = { c: 0, w: 0, s: 0 });
  r.t = Date.now();                                              // per-item timestamp: newer wins when devices are merged
  if (ok) { r.c++; r.s++; } else { r.w++; r.s = 0; progress.m[id] = { sec, n: (progress.m[id] ? progress.m[id].n : 0) + 1, t: Date.now(), label }; }
  if (ok && progress.m[id] && r.s >= 2) delete progress.m[id];      // two right answers in a row clear a mistake
  const d = progress.day[today()] || (progress.day[today()] = { n: 0, ok: 0 }); d.n++; if (ok) d.ok++;
  saveProgress(); listeners.forEach(fn => fn());
}
export const learned = id => progress.r[id] && progress.r[id].s >= 2;
export const countLearned = ids => ids.reduce((n, id) => n + (learned(id) ? 1 : 0), 0);

// merge another copy (e.g. from the sync gist) into this one; returns true if anything changed here
export function mergeProgress(o) {
  if (!o || !o.r) return false;
  let changed = false;
  const newer = (x, y) => (x.t || 0) > (y.t || 0) || (!x.t && !y.t && (x.c + x.w) > (y.c + y.w));
  for (const [id, x] of Object.entries(o.r)) { const y = progress.r[id]; if (!y || newer(x, y)) { progress.r[id] = x; changed = true; } }
  for (const [id, x] of Object.entries(o.m || {})) { const y = progress.m[id], r = progress.r[id];
    if (r && r.s >= 2) continue;                                   // already cleared by a later right answer
    if (!y || (x.t || 0) > (y.t || 0)) { progress.m[id] = x; changed = true; } }
  for (const id of Object.keys(progress.m)) { const r = progress.r[id]; if (r && r.s >= 2) { delete progress.m[id]; changed = true; } }
  for (const [d, x] of Object.entries(o.day || {})) { const y = progress.day[d] || { n: 0, ok: 0 };
    if (x.n > y.n) { progress.day[d] = { n: x.n, ok: x.ok }; changed = true; } }
  if (changed) { saveProgress(); listeners.forEach(fn => fn()); }
  return changed;
}

export function replaceProgress(data) {
  if (!data || !data.r) throw new Error('format');
  progress.r = data.r; progress.m = data.m || {}; progress.day = data.day || {};
  saveProgress(); listeners.forEach(fn => fn());
}
