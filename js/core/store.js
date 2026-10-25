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
  if (ok) { r.c++; r.s++; } else { r.w++; r.s = 0; progress.m[id] = { sec, n: (progress.m[id] ? progress.m[id].n : 0) + 1, t: Date.now(), label }; }
  if (ok && progress.m[id] && r.s >= 2) delete progress.m[id];      // two right answers in a row clear a mistake
  const d = progress.day[today()] || (progress.day[today()] = { n: 0, ok: 0 }); d.n++; if (ok) d.ok++;
  saveProgress(); listeners.forEach(fn => fn());
}
export const learned = id => progress.r[id] && progress.r[id].s >= 2;
export const countLearned = ids => ids.reduce((n, id) => n + (learned(id) ? 1 : 0), 0);

export function replaceProgress(data) {
  if (!data || !data.r) throw new Error('format');
  progress.r = data.r; progress.m = data.m || {}; progress.day = data.day || {};
  saveProgress(); listeners.forEach(fn => fn());
}
