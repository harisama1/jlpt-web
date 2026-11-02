// Practice exams kept only on this computer: local/exams/index.json + local/exams/<id>/exam.json (folder local/ is in .gitignore,
// because the exams are copyrighted course material). On GitHub Pages the files are absent and EXAMS stays [].
// exam.json = {id, title, note, parts: [{id, name, groups: [{title, passage, audio, img, items: [{n, q, opts[4], a, why, vi, audio, img, script, missing}]}]}]}
export const EXAMS = [];
let loading = null;
const get = p => fetch(p, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

export function loadExams() {
  if (!loading) loading = get('local/exams/index.json').then(list => Promise.all(list.map(e => get('local/exams/' + e.file).then(x => {
    x.base = 'local/exams/' + e.file.replace(/[^/]+$/, ''); return x;
  }).catch(() => null)))).then(xs => { EXAMS.push(...xs.filter(Boolean)); return EXAMS; }).catch(() => EXAMS);
  return loading;
}
// one plan unit per exam part; progress key ex:<exam>:<part> holds {best, total, t}
export const partKey = (e, p) => 'ex:' + e.id + ':' + p.id;
export const partItems = p => p.groups.flatMap(g => g.items);
