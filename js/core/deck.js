// No-repeat picking: each scope (section + filters) has a deck; every item is asked once before any repeats.
// A new pass puts mistakes first, then unseen items, then the rest, and pushes the most recent questions to the end.
import { shuffle } from './util.js';
import { progress, decks, saveDecks } from './store.js';

export function pickItem(pool, idOf, scope) {
  const ids = pool.map(idOf), has = new Set(ids);
  let d = decks[scope];
  if (!d || d.n !== ids.length) d = decks[scope] = { n: ids.length, q: [], recent: [] };
  d.q = d.q.filter(id => has.has(id));
  if (!d.q.length) {
    const rec = new Set(d.recent), S = progress;
    const order = [ids.filter(id => S.m[id]), ids.filter(id => !S.m[id] && !S.r[id]), ids.filter(id => !S.m[id] && S.r[id])].map(shuffle).flat();
    d.q = order.filter(id => !rec.has(id)).concat(order.filter(id => rec.has(id)));
  }
  const id = d.q.shift();
  d.recent = [id, ...d.recent.filter(x => x !== id)].slice(0, Math.min(40, Math.floor(ids.length / 2)));
  saveDecks();
  return pool[ids.indexOf(id)];
}

// up to n distinct values from pool, different from answer
export function distract(answer, pool, n = 3) {
  const out = [], seen = new Set([answer]);
  for (const x of shuffle(pool)) { if (x && !seen.has(x)) { seen.add(x); out.push(x); if (out.length === n) break; } }
  return out;
}

// pick k items from src whose `key` differs from the answer and from each other
export function takeDistinct(answerItem, key, src, k = 3) {
  const seen = new Set([answerItem[key]]), out = [];
  for (const x of src) if (x[key] && !seen.has(x[key])) { seen.add(x[key]); out.push(x); if (out.length === k) break; }
  return out;
}

// How alike two kana readings sound: shared head/tail + similar length (used for "readings that look almost the same")
export function readingSimilarity(a, b) {
  if (!a || !b || a === b) return -1;
  let head = 0; while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0; while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const common = [...new Set(a)].filter(c => b.includes(c)).length;
  return 3 * head + 2 * tail + common - 2 * Math.abs(a.length - b.length);
}
export function similarReadings(answer, items, key = 'r', k = 3) {
  const scored = items.filter(x => x[key] && x[key] !== answer[key]).map(x => [readingSimilarity(answer[key], x[key]) + Math.random(), x]);
  scored.sort((p, q) => q[0] - p[0]);
  return takeDistinct(answer, key, scored.slice(0, 40).map(s => s[1]), k);
}
