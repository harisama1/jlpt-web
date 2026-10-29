"""Build the JSON database of the JLPT review web app.
inputs : vocab_raw.json, kanji_raw.json, grammar_raw.json (parsed from the PDFs by parse_*.py),
         missing.tsv (reference words absent from the PDF), vi_part*.txt (their Vietnamese meanings + topic),
         grammar_add.txt, sentences.txt (hand-written items), ../data/reading.json
outputs: ../data/{topics,vocab,kanji,grammar,sentences}.json
usage  : build_data.py <dir with *_raw.json and missing.tsv>"""
import sys, os, re, json, random, collections
SRC = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data')
random.seed(20261206)
JP = re.compile(r'[぀-ヿ一-鿿々〜～]')
KANJI = re.compile(r'[一-鿿々]')
LV = {'N5': 5, 'N4': 4, 'N3': 3}

# ---------------- topics
raw = json.load(open(os.path.join(SRC, 'vocab_raw.json'), encoding='utf-8'))
topics = collections.OrderedDict()
for e in raw:
    if e['sec'].startswith('2.'):
        topics.setdefault(e['sec'], {'id': e['sec'], 'name': re.sub(r'\s+', ' ', e['topic']).strip(), 'group': 'Theo chủ đề'})
topics['M'] = {'id': 'M', 'name': 'Màu sắc', 'group': 'Theo chủ đề'}
topics['K'] = {'id': 'K', 'name': 'Kính ngữ (尊敬語・謙譲語)', 'group': 'Theo chủ đề'}
topics['S'] = {'id': 'S', 'name': 'Tiền tố – hậu tố (〜さん, 〜ごろ, 〜ずつ…)', 'group': 'Theo chủ đề'}
for e in raw:
    if e['sec'].startswith('3.'):
        topics.setdefault(e['sec'], {'id': e['sec'], 'name': re.sub(r'\s+', ' ', e['topic']).strip(), 'group': 'N3 trọng tâm (kèm cụm từ)'})

# ---------------- vocabulary
vocab, seen = [], set()
def add(word, read, vi, lv, topic, ex='', src='pdf'):
    word = word.strip(); read = read.strip()
    if not word or not JP.search(word) or re.search(r'[A-Za-zÀ-ỹ]', word): return
    if word[0] in '／/' or re.search(r'[A-Za-zÀ-ỹ:]', read): return     # rows of the "easily confused words" table
    if word == '生む' and not read: read = 'うむ'
    if not vi or not lv: return
    key = (word, read, topic)
    if key in seen: return
    seen.add(key)
    vi = vi.strip()
    if vi[:1].isupper() and vi[1:2].islower() and not re.match(r'^(Tết|Phật|Giáng|Nhật|Mỹ|Trung|Việt|Hàn|Anh|Pháp|Đức|Chúa|Thần|Tokyo|Kyoto|Âu|Thái)', vi):
        vi = vi[0].lower() + vi[1:]
    vocab.append({'id': 'v%d' % len(vocab), 'w': word, 'r': read if read != word else '', 'vi': vi, 'lv': lv,
                  't': topic, 'ex': ex.strip(), 'src': src})
for e in raw:
    add(e['word'], e['read'], e['vi'], e['lv'], e['sec'], e.get('ex', ''))
vi = {}
for fn in sorted(os.listdir(HERE)):
    if fn.startswith('vi_part'):
        for l in open(os.path.join(HERE, fn), encoding='utf-8'):
            p = l.rstrip('\n').split('|')
            if len(p) == 3 and p[0].isdigit(): vi[int(p[0])] = (p[1], p[2])
missing = [l.rstrip('\n').split('\t') for l in open(os.path.join(SRC, 'missing.tsv'), encoding='utf-8')]
nomean = 0
for i, (lv, w, r, en) in enumerate(missing, 1):
    if i not in vi: nomean += 1; continue
    m, t = vi[i]
    r = re.sub(r'^\(.*?\)\s*', '', r).strip()
    r = re.sub(r'\s*\(.*?\)', '', r).replace('～', '〜').strip()
    add(w.replace('～', '〜'), r, m, lv, t, src='bổ sung')
print('vocab', len(vocab), '| supplements without meaning:', nomean)

# ---------------- kanji + the words built from each kanji
kraw = json.load(open(os.path.join(SRC, 'kanji_raw.json'), encoding='utf-8'))
by_char = collections.defaultdict(list)
for v in vocab:
    if '・' in v['w'] or '／' in v['w']: continue          # lists like 東・西・南・北 are not compounds
    for ch in set(KANJI.findall(v['w'])): by_char[ch].append(v)
kw_vi = dict(l.rstrip('\n').split('|', 1) for l in open(os.path.join(HERE, 'vi_kanji_words.txt'), encoding='utf-8') if '|' in l)
kanji = []
for k in kraw:
    words, used = [], set()
    for ex in k['ex']:                      # the PDF's own examples first
        m = next((v for v in by_char.get(k['k'], []) if v['w'] == ex['w']), None)
        words.append({'w': ex['w'], 'r': ex['r'], 'vi': m['vi'] if m else kw_vi.get(ex['w'], ''), 'lv': m['lv'] if m else ''}); used.add(ex['w'])
    cands = sorted({v['w']: v for v in by_char.get(k['k'], []) if v['w'] not in used}.values(),
                   key=lambda v: (-len(KANJI.findall(v['w'])) >= -1, -LV[v['lv']], len(v['w'])))
    cands = sorted(cands, key=lambda v: (0 if len(KANJI.findall(v['w'])) >= 2 else 1, -LV[v['lv']], len(v['w'])))
    for v in cands[:10]:
        words.append({'w': v['w'], 'r': v['r'], 'vi': v['vi'], 'lv': v['lv']})
    kanji.append({'id': 'k%d' % len(kanji), 'k': k['k'], 'lv': k['lv'], 'hv': k['hv'], 'on': k['on'], 'kun': k['kun'],
                  'story': k.get('story', ''), 'words': words})
print('kanji', len(kanji), '| avg words per kanji %.1f' % (sum(len(k['words']) for k in kanji) / len(kanji)))

# ---------------- extra words (tools/extra_words.tsv: w, r, vi, en, lv) — topic "Từ bổ sung"
topics['X'] = {'id': 'X', 'name': 'Từ bổ sung', 'group': 'Bổ sung'}
for _l in open(os.path.join(HERE, 'extra_words.tsv'), encoding='utf-8'):
    if _l.startswith('#') or not _l.strip(): continue
    _w, _r, _vi, _en, _lv = _l.rstrip('\n').split('\t')
    if any(v['w'] == _w for v in vocab): continue
    vocab.append({'id': 'v%d' % len(vocab), 'w': _w, 'r': _r, 'vi': _vi, 'lv': _lv, 't': 'X', 'ex': '', 'src': 'extra', 'en': _en})

# ---------------- words collected from photographed textbooks (tools/photo_words.tsv: w, r, vi, en, lv) — topic "P"
topics['P'] = {'id': 'P', 'name': 'Từ sách (ảnh 10/2026)', 'group': 'Bổ sung'}
for _l in open(os.path.join(HERE, 'photo_words.tsv'), encoding='utf-8'):
    if _l.startswith('#') or not _l.strip(): continue
    _w, _r, _vi, _en, _lv = _l.rstrip('\n').split('\t')
    if any(v['w'] == _w for v in vocab): continue
    vocab.append({'id': 'v%d' % len(vocab), 'w': _w, 'r': _r, 'vi': _vi, 'lv': _lv, 't': 'P', 'ex': '', 'src': 'photo', 'en': _en})

# ---------------- grammar
graw = json.load(open(os.path.join(SRC, 'grammar_raw.json'), encoding='utf-8'))
clean = []
for g in graw:
    p = g['p'].strip()
    if not JP.search(p) or len(re.findall(r'[a-zà-ỹ]', p)) > 3: continue
    if clean and not re.match(r'^[〜～VNAa-zA-Z（(普可見疑尊丁受迷使Th一-龯ぁ-んァ-ン]', p): clean[-1]['p'] += p; continue
    if clean and re.match(r'^(り|ど|う|される|なら|している)', p) and clean[-1]['lv'] == g['lv']:
        clean[-1]['p'] += p; clean[-1]['ex'] += g['ex']; continue
    if p.startswith('これ・それ・あれ・どれ'): p = 'こ・そ・あ・ど（これ／この／ここ…）'
    g['p'] = p; clean.append(g)
def cores(pattern):
    """the Japanese pieces of a pattern that should appear in an example sentence"""
    s = re.sub(r'（[^）]*）|\([^)]*\)|\[[^\]]*\]', '', pattern)
    out = set()
    for part in re.split(r'[／・、,〜～…]', s):
        part = re.sub(r'^(V(ます|る|た|て|ない)?|N\d?|Aい|Aな|A|普通形|Thể\S*)', '', part.replace('＋', '+'))
        for piece in part.split('+'):
            piece = re.sub(r'(V(ます|る|た|て|ない)?|N\d?|Aい|Aな)', ' ', piece).strip()
            for q in piece.split():
                q = re.sub(r'[^぀-ヿ一-鿿々]', '', q)
                if q: out.add(q)
    return sorted(out, key=len, reverse=True)
grammar = []
for g in clean:
    ex = []
    for s in g['ex']:
        s = s.replace('。。', '。').strip()
        if JP.search(s): ex.append({'jp': s, 'vi': ''})
    mean = re.sub(r'\s*\[(NP|TV|KJ|ĐH|NV) §[^\]]*\]\s*', ' ', g['mean']).strip(' .')
    grammar.append({'id': 'g%d' % len(grammar), 'p': g['p'], 'lv': g['lv'], 'grp': g.get('grp', ''), 'mean': mean,
                    'struct': g['struct'], 'ex': ex, 'cores': cores(g['p']), 'q': []})
for l in open(os.path.join(HERE, 'grammar_add.txt'), encoding='utf-8'):
    if l.startswith('#') or not l.strip(): continue
    lv, p, mean, st, sent, tr, ds = l.rstrip('\n').split('|')
    m = re.search(r'【(.+?)】', sent)
    jp = sent.replace('【', '').replace('】', '')
    grammar.append({'id': 'g%d' % len(grammar), 'p': p, 'lv': lv, 'grp': 'Bổ sung', 'mean': mean, 'struct': st,
                    'ex': [{'jp': jp, 'vi': tr}], 'cores': [m.group(1)], 'add': True,
                    'q': [{'s': sent.replace(m.group(0), '（　　）'), 'a': m.group(1), 'd': ds.split(';'), 'vi': tr}]})
# cloze items for the PDF grammar: blank the pattern inside its own example; distractors = other patterns of the level
pool = collections.defaultdict(list)
BAD_CORE = re.compile(r'(この|その|あの|どの|これ|それ|あれ|どれ|だれ|どこ|一番|ここ|そこ)')
for g in grammar:
    for c in g['cores'][:1]:
        if 1 <= len(c) <= 9 and not BAD_CORE.search(c): pool[g['lv']].append(c)
PARTICLES = ['は', 'が', 'を', 'に', 'で', 'へ', 'と', 'も', 'から', 'まで', 'や', 'の', 'か', 'ね', 'よ']
nq = 0
for g in grammar:
    if g.get('add'): continue
    for e in g['ex'][:2]:
        hit = next((c for c in g['cores'] if c in e['jp'] and (len(c) >= 2 or c in PARTICLES)), None)
        if not hit: continue
        others = [c for c in set(pool[g['lv']]) if c != hit and c not in e['jp'] and abs(len(c) - len(hit)) <= 3]
        if len(hit) <= 2 and hit in PARTICLES: others = [c for c in PARTICLES if c != hit and c not in g['cores']]
        if len(others) < 3: continue
        i = e['jp'].find(hit)
        g['q'].append({'s': e['jp'][:i] + '（　　）' + e['jp'][i + len(hit):], 'a': hit, 'd': random.sample(others, 3), 'vi': e['vi']})
        nq += 1
print('grammar', len(grammar), collections.Counter(g['lv'] for g in grammar), '| cloze items', nq + sum(1 for g in grammar if g.get('add')))
# hand-checked wrong options for the cloze items above (grammar_fix.txt: "D|<id>.<i>|w1;w2;w3|ok/FIX note")
byid = {g['id']: g for g in grammar}
if os.path.exists(os.path.join(HERE, 'grammar_fix.txt')):
    nfix = 0
    for l in open(os.path.join(HERE, 'grammar_fix.txt'), encoding='utf-8'):
        f = l.rstrip('\n').split('|')
        if len(f) < 3 or f[0] not in ('D', 'S'): continue
        gid, i = f[1].rsplit('.', 1); g = byid.get(gid)
        if not g or int(i) >= len(g['q']): continue
        if f[0] == 'D': g['q'][int(i)]['d'] = f[2].split(';'); nfix += 1
        else:                                          # S: replace the whole item (broken sentence)
            m = re.search(r'【(.+?)】', f[2]); g['q'][int(i)] = {'s': f[2].replace(m.group(0), '（　　）'), 'a': m.group(1), 'd': f[4].split(';'), 'vi': f[3]}; nfix += 1
    print('grammar cloze wrong options replaced', nfix)
# more practice / examples per pattern (grammar_more.txt: "Q|<p>|<sentence with 【answer】>|<vi>|w1;w2;w3" and "E|<p>|<jp>|<vi>")
if os.path.exists(os.path.join(HERE, 'grammar_more.txt')):
    byp = {g['p']: g for g in grammar}; nq2 = ne2 = 0; miss = collections.Counter()
    for l in open(os.path.join(HERE, 'grammar_more.txt'), encoding='utf-8'):
        f = l.rstrip('\n').split('|')
        if not f or f[0] not in ('Q', 'E') or len(f) < 4: continue
        g = byp.get(f[1])
        if not g: miss[f[1]] += 1; continue
        if f[0] == 'E': g['ex'].append({'jp': f[2], 'vi': f[3]}); ne2 += 1; continue
        m = re.search(r'【(.+?)】', f[2])
        if not m or len(f) < 5: continue
        g['q'].append({'s': f[2].replace(m.group(0), '（　　）'), 'a': m.group(1), 'd': f[4].split(';'), 'vi': f[3]}); nq2 += 1
    print('grammar_more: +%d questions, +%d examples' % (nq2, ne2), ('| unknown patterns: %s' % dict(miss)) if miss else '')
# theory per pattern (grammar_theory.txt: "## <p>" then C:/D:/L: lines = form / usage / notes); first block of a p wins
theory, cur = {}, None
for l in open(os.path.join(HERE, 'grammar_theory.txt'), encoding='utf-8'):
    l = l.rstrip('\n')
    if l.startswith('## '):
        cur = None if l[3:].strip() in theory else theory.setdefault(l[3:].strip(), {})
    elif cur is not None and l[:2] in ('C:', 'D:', 'L:'):
        cur[{'C:': 'form', 'D:': 'use', 'L:': 'note'}[l[:2]]] = l[2:].strip()
for g in grammar:
    if g['p'] in theory: g['th'] = theory[g['p']]
print('grammar theory', sum(1 for g in grammar if 'th' in g), '/', len(grammar))

# ---------------- sentence patterns (文脈規定 / 言い換え)
sents = []
for l in open(os.path.join(HERE, 'sentences.txt'), encoding='utf-8'):
    if l.startswith('#') or not l.strip(): continue
    p = l.rstrip('\n').split('|')
    if p[0] == 'B':
        _, s, tr, ds, lv = p
        m = re.search(r'【(.+?)】', s)
        sents.append({'id': 's%d' % len(sents), 'kind': '文脈規定', 's': s.replace(m.group(0), '（　　）'), 'a': m.group(1), 'd': ds.split(';'), 'vi': tr, 'lv': lv})
    else:
        _, s, tr, a, ds, lv = p
        sents.append({'id': 's%d' % len(sents), 'kind': '言い換え', 's': s, 'a': a, 'd': ds.split(';'), 'vi': tr, 'lv': lv})
# generated 文脈規定 from the N3 focus words that carry a phrase: 子供の進学について考える -> 子供の（　）について考える
gen = 0
by_topic = collections.defaultdict(list)
for v in vocab: by_topic[v['t']].append(v)
for v in vocab:
    if not v['ex'] or not v['w'] or len(v['w']) < 2: continue
    segs = [x.strip() for x in re.split(r'[合関対連類]：|[、／。]', v['ex'])]
    phrase = next((x for x in segs if v['w'] in x and '：' not in x), '')
    if not phrase or len(phrase) < len(v['w']) + 4 or re.search(r'[a-zà-ỹA-Z]', phrase) or not re.search(r'[ぁ-ん]', phrase.replace(v['w'], '')): continue
    same = [x['w'] for x in by_topic[v['t']] if x['w'] != v['w'] and len(KANJI.findall(x['w'])) == len(KANJI.findall(v['w'])) and x['w'] not in phrase]
    if len(same) < 3: continue
    sents.append({'id': 's%d' % len(sents), 'kind': '文脈規定', 's': phrase.replace(v['w'], '（　　）', 1), 'a': v['w'],
                  'd': random.sample(same, 3), 'vi': v['vi'], 'lv': v['lv'], 'gen': True})
    gen += 1
print('sentences', len(sents), '(generated from phrases: %d)' % gen)

syn_rows = [l.rstrip('\n').split('|') for l in open(os.path.join(HERE, 'synonyms.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')]
grp = {}
def gf(x):
    grp.setdefault(x, x)
    while grp[x] != x: grp[x] = grp[grp[x]]; x = grp[x]
    return x
for pos, w, r, a, lv, m in syn_rows: grp[gf(w)] = gf(a)       # chains like 突然 = 急に = いきなり form one group
synonyms = []
for i, (pos, w, r, a, lv, m) in enumerate(syn_rows):
    cand = sorted({x[3] for x in syn_rows if x[0] == pos and gf(x[3]) != gf(w)} | {x[1] for x in syn_rows if x[0] == pos and gf(x[1]) != gf(w)})
    synonyms.append({'id': 'y%d' % i, 'pos': pos, 'w': w, 'r': r if r != w else '', 'a': a, 'lv': lv, 'vi': m, 'd': random.sample(cand, 3)})
print('synonyms', len(synonyms), collections.Counter(x['pos'] for x in synonyms))
def table(fn):
    return [l.rstrip('\n').split('|', 1) for l in open(os.path.join(HERE, fn), encoding='utf-8') if '|' in l and not l.startswith('#')]
# sentence translations for the grammar cloze items
gvi = dict(table('grammar_vi.txt'))
for g in grammar:
    for i, q in enumerate(g['q']):
        if not q.get('vi'): q['vi'] = gvi.get('%s.%d' % (g['id'], i), '')
print('grammar cloze translated', sum(1 for g in grammar for q in g['q'] if q['vi']), '/', sum(len(g['q']) for g in grammar))
# meanings of answer options that are not vocab entries (synonym pairs, conjugated stems, grammar fragments)
gloss = {}
for pos, w, r, a, lv, m in syn_rows:
    gloss.setdefault(w, m); gloss.setdefault(a, m)
gloss.update(dict(table('option_vi.txt')))
json.dump(gloss, open(os.path.join(OUT, 'gloss.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('gloss', len(gloss))
reading = json.load(open(os.path.join(OUT, 'reading.json'), encoding='utf-8'))
for name, data in (('topics', list(topics.values())), ('vocab', vocab), ('kanji', kanji), ('grammar', grammar), ('sentences', sents), ('synonyms', synonyms)):
    json.dump(data, open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
tc = collections.Counter(v['t'] for v in vocab)
print('topics', len(topics), {t: tc[t] for t in list(topics)[:6]}, '...')
print('reading passages', len(reading))
