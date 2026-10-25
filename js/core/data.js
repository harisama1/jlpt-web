// Loads data/manifest.json and every dataset it lists, then builds lookup indexes.
// To add data later (N2/N1, new sections): add the JSON file, list it in the manifest, set the level to "available".
export const DB = { manifest: null };

const getJSON = p => fetch('data/' + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });

export async function loadData() {
  const m = DB.manifest = await getJSON('manifest.json');
  const req = Object.entries(m.files), opt = Object.entries(m.optional || {});
  const res = await Promise.all(req.map(([, f]) => getJSON(f)));
  req.forEach(([k], i) => { DB[k] = res[i]; });
  const optRes = await Promise.all(opt.map(([, f]) => getJSON(f).catch(() => null)));
  opt.forEach(([k], i) => { DB[k] = optRes[i]; });
  index();
}

function index() {
  const by = (arr, f = x => x.id) => Object.fromEntries(arr.map(x => [f(x), x]));
  DB.levels = DB.manifest.levels;
  DB.vById = by(DB.vocab); DB.kById = by(DB.kanji);
  DB.gq = []; DB.grammar.forEach(g => g.q.forEach((q, i) => DB.gq.push({ id: g.id + '.' + i, g, q })));
  DB.gqById = by(DB.gq); DB.sById = by(DB.sentences); DB.yById = by(DB.synonyms);
  DB.topicName = Object.fromEntries(DB.topics.map(t => [t.id, t.name]));
  DB.groups = [...new Set(DB.grammar.map(g => g.grp).filter(Boolean))];
  DB.byW = {}; DB.byR = {};
  DB.vocab.forEach(v => { DB.byW[v.w] = DB.byW[v.w] || v; if (v.r) DB.byR[v.r] = DB.byR[v.r] || v; });
  DB.core = {}; DB.grammar.forEach(g => (g.cores || []).forEach(c => { if (!DB.core[c]) DB.core[c] = g; }));
  DB.hv = {}; DB.kanji.forEach(k => (DB.hv[k.hv] = DB.hv[k.hv] || []).push(k.k));
  DB.kw = {}; DB.kanji.forEach(k => k.words.forEach(w => { if (!DB.kw[w.w]) DB.kw[w.w] = w; }));
  DB.allKanjiWords = DB.kanji.flatMap(k => k.words.filter(w => w.r && w.vi));
}

export const levelAvailable = lv => (DB.levels.find(l => l.id === lv) || {}).available;

// Vietnamese meaning of an answer option (word, reading, grammar fragment) — used by every explanation
export function meanOf(o) {
  const v = DB.byW[o] || DB.byR[o];
  if (v) return (v.r && v.r !== o ? v.w + '【' + v.r + '】' : v.w !== o ? v.w : '') + (v.w !== o || v.r && v.r !== o ? ': ' : '') + v.vi;
  const w = DB.kw[o]; if (w && w.vi) return (w.r ? '【' + w.r + '】 ' : '') + w.vi;
  if (DB.gloss[o]) return DB.gloss[o];
  const g = DB.core[o]; if (g) return 'mẫu ' + g.p + ': ' + g.mean;
  return '';
}

export function daysLeft() {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(DB.manifest.exam + 'T00:00:00') - t) / 86400000);
}
