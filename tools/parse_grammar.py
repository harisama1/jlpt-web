"""Grammar tables of 3_Ngu_phap_N5-N3.pdf (pdftotext -bbox) -> JSON: pattern, level, group, meaning, structure, examples.
usage: parse_grammar.py <bbox.html> <out.json>"""
import re, sys, html, json, collections
pages = open(sys.argv[1], encoding='utf-8').read().split('<page ')[1:]
def words(p):
    return [(float(a), float(b), html.unescape(t)) for a, b, c, d, t in
            re.findall(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<', p)]
def lines(ws, tol=3.0):
    rows = []
    for w in sorted(ws, key=lambda w: (w[1], w[0])):
        if rows and abs(rows[-1][0] - w[1]) < tol: rows[-1][1].append(w)
        else: rows.append([w[1], [w]])
    return rows
LEVEL = {'2': 'N5', '3': 'N4', '4': 'N3', '5': 'N3'}
STRUCT = re.compile(r'^(V|N|A|Thể|Câu|〜|普通形|Vる|Vた|Vて|Vない)\S*\s*([^\sa-zà-ỹ]|$)')
out, level, group, cols, cur = [], None, '', None, None
for p in pages:
    ws = [w for w in words(p) if w[1] > 40]
    for y, rw in lines(ws):
        rw.sort(key=lambda w: w[0]); t = [w[2] for w in rw]
        line = ' '.join(t)
        m = re.match(r'^(\d)\.(\d+)$', t[0]) if rw[0][0] < 60 else None
        if m and not re.search(r'\.\s\.', line):
            level = LEVEL.get(m.group(1)); group = ' '.join(t[1:]); cols = None; cur = None; continue
        if rw[0][0] < 60 and re.fullmatch(r'\d', t[0]) and len(t) > 1 and not re.search(r'\.\s\.', line):
            if t[0] in ('6', '7', '8'): level = None
            continue
        if not level: continue
        if t[0] == 'Mẫu' and 'Nghĩa' in t:
            xs = {w[2]: w[0] for w in rw}; cols = (xs['Mẫu'], xs['Nghĩa'], xs.get('Ví', 312)); continue
        if not cols: continue
        if line.startswith('[Liên quan') or line.startswith('【過去問】') or re.fullmatch(r'\d+', line): cur = None; continue
        a, b, c = cols
        pat = ''.join(w[2] for w in rw if a - 3 <= w[0] < b - 3)
        mean = ' '.join(w[2] for w in rw if b - 3 <= w[0] < c - 3)
        ex = ''.join(w[2] for w in rw if w[0] >= c - 3)
        starts = pat and (not cur or (mean and (mean[0].isupper() or mean[0] in '〜（(') ))
        if starts and not (cur and mean and mean[:1].islower()):
            cur = {'p': pat, 'lv': level, 'grp': group, 'mean': [], 'struct': [], 'ex': ''}
            out.append(cur)
        elif pat and cur: cur['p'] += pat
        if not cur: continue
        if mean:
            if STRUCT.match(mean) and cur['mean']: cur['struct'].append(mean)
            else: cur['mean'].append(mean)
        if ex: cur['ex'] += ex
for g in out:
    g['mean'] = re.sub(r'\s+', ' ', ' '.join(g['mean'])).strip()
    g['struct'] = re.sub(r'\s+', ' ', ' '.join(g['struct'])).strip()
    g['ex'] = [s + '。' for s in re.split(r'(?<=[。？！?])', g['ex']) if s.strip()]
    g['ex'] = [s.rstrip('。') if s.endswith(('？。', '！。', '?。')) else s for s in g['ex']]
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(collections.Counter(g['lv'] for g in out), len(out))
