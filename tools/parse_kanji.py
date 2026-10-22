"""Kanji tables of 2_Kanji_N5-N3.pdf (pdftotext -layout) -> JSON: kanji, Hán Việt, on, kun, examples, memory story.
usage: parse_kanji.py <layout.txt> <out.json>"""
import re, sys, json
L = open(sys.argv[1], encoding='utf-8').read().split('\n')
ROW = re.compile(r'^\s{0,5}(\d{1,3})\s+([一-鿿々])\s+([A-ZÀ-Ỹ][A-ZÀ-Ỹ ,/／]*?)\s{2,}(\S.*?)\s{2,}(\S.*?)\s{2,}(\S.*)$')
level, out, cur = None, [], None
for l in L:
    m = re.match(r'^(\d)\s+Kanji (N[345])', l)
    if m and not re.search(r'\.\s\.', l): level = m.group(2); continue
    if re.match(r'^6\s+Kanji dễ nhầm', l): level = None
    if not level: continue
    m = ROW.match(l)
    if m:
        cur = {'k': m.group(2), 'lv': level, 'hv': m.group(3).strip(), 'on': m.group(4).strip(), 'kun': m.group(5).strip(),
               'ex': m.group(6).strip(), 'story': ''}
        out.append(cur); continue
    if cur is None: continue
    s = l.strip()
    if not s or re.match(r'^(N5 – N3|\d+$|#|Nhóm \d)', s): continue
    if s.startswith('、') or re.match(r'^[぀-ヿ一-鿿（）、]+$', s): cur['ex'] += s; continue
    if re.match(r'^[ぁ-んァ-ン・／]+$', s) and len(l) - len(l.lstrip()) > 30: cur['kun'] += s; continue
    if len(l) - len(l.lstrip()) >= 6 and re.search(r'[a-zà-ỹ]', s): cur['story'] = (cur['story'] + ' ' + s).strip()
for k in out:
    k['ex'] = [{'w': a, 'r': b} for a, b in re.findall(r'([^、（）\s]+)（([^）]+)）', k['ex'])]
    for f in ('on', 'kun'): k[f] = '' if k[f] in ('—', '-') else k[f]
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
import collections
print(collections.Counter(k['lv'] for k in out), 'stories', sum(1 for k in out if k['story']), 'unique', len({k['k'] for k in out}))
