"""Rebuild the vocabulary tables of 1_Tu_vung_N5-N3.pdf from word coordinates (pdftotext -bbox).
usage: parse_vocab.py <bbox.html> <out.json>"""
import re, sys, html, json, collections
src, out = sys.argv[1], sys.argv[2]
pages = open(src, encoding='utf-8').read().split('<page ')[1:]
def words(p):
    return [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in
            re.findall(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<', p)]
def lines(ws, tol=3.5):
    rows = []
    for w in sorted(ws, key=lambda w: (w[1], w[0])):
        if rows and abs(rows[-1][0] - w[1]) < tol: rows[-1][1].append(w)
        else: rows.append([w[1], [w]])
    return rows
entries = []
section = None
HEAD = re.compile(r'^(\d)\.(\d+)$')
for pi, p in enumerate(pages):
    ws = [w for w in words(p) if w[1] > 40]          # drop running header
    rows = lines(ws)
    i = 0
    cols = None
    while i < len(rows):
        y, rw = rows[i]
        rw.sort(key=lambda w: w[0])
        texts = [w[4] for w in rw]
        # section heading: "2.9  Ăn uống" (left margin, no dotted leaders)
        if rw[0][0] < 60 and HEAD.match(texts[0]) and '.' not in ''.join(texts[1:3]).replace('.', '', 0)[:1] and not any('. .' in t for t in texts):
            title = ' '.join(texts[1:])
            if not re.search(r'\.\s*\.', ' '.join(texts)) and len(rw) < 14:
                section = (texts[0], title)
        # table header: Từ … Đọc … Nghĩa (… Từ … Đọc … Nghĩa)
        if texts[0] == 'Từ' and 'Nghĩa' in texts and ('Đọc' in texts or 'Cách' in texts):
            xs = [(w[0], w[4]) for w in rw]
            groups = []
            for k, (x, t) in enumerate(xs):
                if t == 'Từ':
                    g = {'w': x}
                    for x2, t2 in xs[k + 1:]:
                        if t2 == 'Từ': break
                        if t2 in ('Đọc', 'Cách'): g.setdefault('r', x2)
                        elif t2 == 'Nghĩa': g['m'] = x2
                        elif t2 in ('Cụm', 'Ví', 'Câu'): g.setdefault('x', x2)
                    groups.append(g)
            for k, g in enumerate(groups): g['end'] = groups[k + 1]['w'] - 4 if k + 1 < len(groups) else 600
            cols = groups; i += 1; continue
        if cols and section:
            # each group: a row starts where something sits in the word column
            for g in cols:
                left = [w for w in rw if g['w'] - 3 <= w[0] < g.get('r', g['m']) - 3]
                if not left: continue
                # band: this row and following rows until the next word-column entry or a new header/section
                band = list(rw)
                j = i + 1
                while j < len(rows):
                    y2, r2 = rows[j]
                    if y2 - y > 40: break
                    if any(g['w'] - 3 <= w[0] < g.get('r', g['m']) - 3 for w in r2): break
                    t2 = [w[4] for w in sorted(r2, key=lambda w: w[0])]
                    if 'Nghĩa' in t2 or (sorted(r2)[0][0] < 60 and HEAD.match(t2[0])): break
                    band += r2; j += 1
                band = [w for w in band if g['w'] - 3 <= w[0] < g['end']]
                def col(a, b): return ' '.join(w[4] for w in sorted([w for w in band if a <= w[0] < b], key=lambda w: (round(w[1]), w[0])))
                lv_w = [w for w in band if re.fullmatch(r'N[345]', w[4])]
                lvx = min([w[0] for w in lv_w], default=g['end'])
                e = {'sec': section[0], 'topic': section[1], 'word': col(g['w'] - 3, g.get('r', g['m']) - 3).replace(' ', ''),
                     'read': col(g.get('r', 9e9) - 3, g['m'] - 3).replace(' ', '') if 'r' in g else '',
                     'vi': col(g['m'] - 3, min(lvx, g.get('x', 9e9)) - 3).replace(' ,', ','),
                     'lv': lv_w[0][4] if lv_w else '', 'ex': col(g['x'] - 3, lvx - 3) if 'x' in g else '', 'page': pi + 1}
                entries.append(e)
        i += 1
# clean: drop headings read as rows, glue wrapped words (no meaning, no level) onto the row above
seen = set(); clean = []
merged = []
for e in entries:
    if not e['word'] or e['word'] in ('Từ',) or re.match(r'^\d+\.\d+', e['word']): continue
    if not e['vi'].strip() and not e['lv'] and merged and merged[-1]['page'] == e['page'] and merged[-1]['sec'] == e['sec']:
        merged[-1]['word'] += e['word']; merged[-1]['read'] += e['read']; continue
    merged.append(e)
for e in merged:
    if e['sec'].startswith('3.') and not e['lv']: e['lv'] = 'N3'
    e['vi'] = re.sub(r'\s+', ' ', e['vi']).strip()
    k = (e['sec'], e['word'], e['read'])
    if k in seen: continue
    seen.add(k); clean.append(e)
json.dump(clean, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
c = collections.Counter((e['sec'], e['topic']) for e in clean)
for k, v in sorted(c.items(), key=lambda kv: [int(x) for x in kv[0][0].split('.')]): print(k, v)
print('total', len(clean))
