// Sync progress across devices through a secret GitHub Gist owned by the learner (no server).
// Each device stores a GitHub token with only the "gist" scope; the gist holds one file FILE = {progress, at}.
// pull() merges the gist copy into this browser (newer item wins, see store.mergeProgress); push() uploads the merged copy.
import { progress, onProgress, mergeProgress } from './store.js';

const KEY = 'jlpt-web-sync-v1', FILE = 'jlpt-web-progress.json', API = 'https://api.github.com';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
export const sync = load();                     // {token, gistId, last, err}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sync)); } catch (e) { } };
const listeners = new Set();
export const onSync = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => fn());
export const connected = () => !!(sync.token && sync.gistId);

async function gh(path, opts = {}) {
  const r = await fetch(API + path, Object.assign({}, opts, { headers: { Authorization: 'Bearer ' + sync.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } }));
  if (r.status === 401) throw new Error('Token sai hoặc đã hết hạn');
  if (r.status === 403 || r.status === 404) throw new Error('Token thiếu quyền "gist" (' + r.status + ')');
  if (!r.ok) throw new Error('GitHub trả lỗi ' + r.status);
  return r.status === 204 ? null : r.json();
}

// connect with a token: find the existing sync gist (so a 2nd device joins the same one) or create a secret gist
export async function connect(token) {
  sync.token = token.trim(); sync.err = '';
  let id = null;
  for (let page = 1; page <= 5 && !id; page++) {
    const list = await gh('/gists?per_page=100&page=' + page);
    const g = list.find(x => x.files && x.files[FILE]); if (g) id = g.id;
    if (list.length < 100) break;
  }
  if (!id) id = (await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'Ôn JLPT — đồng bộ tiến độ', public: false, files: { [FILE]: { content: JSON.stringify({ progress, at: Date.now() }) } } }) })).id;
  sync.gistId = id; save();
  await now();
}

export function disconnect() { delete sync.token; delete sync.gistId; sync.last = 0; sync.err = ''; save(); emit(); }

async function pull() {
  const g = await gh('/gists/' + sync.gistId), f = g.files[FILE];
  if (!f) return;
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  mergeProgress(JSON.parse(text).progress);
}
async function push() {
  await gh('/gists/' + sync.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify({ progress, at: Date.now() }) } } }) });
}

let busy = null, timer = null;
// pull + merge + push; serialised so two calls never overlap
export function now() {
  if (!connected()) return Promise.resolve();
  busy = (busy || Promise.resolve()).then(async () => {
    try { await pull(); await push(); sync.last = Date.now(); sync.err = ''; }
    catch (e) { sync.err = e.message || String(e); }
    save(); emit();
  });
  return busy;
}
// after answers: upload a few seconds after the last one; and when the tab is hidden/closed
const later = () => { if (!connected()) return; clearTimeout(timer); timer = setTimeout(now, 4000); };
onProgress(later);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); timer = null; now(); } });
