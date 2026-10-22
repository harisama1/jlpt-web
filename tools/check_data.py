"""Sanity checks over data/*.json: every question must have 1 answer + 3 distinct, non-empty distractors that differ from it."""
import json, re, collections, os, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
L = lambda n: json.load(open(os.path.join(D, n + '.json'), encoding='utf-8'))
V, K, G, S, R, T = L('vocab'), L('kanji'), L('grammar'), L('sentences'), L('reading'), L('topics')
probs = collections.defaultdict(list)
tid = {t['id'] for t in T}
JP = re.compile(r'[぀-ヿ一-鿿]')
for v in V:
    if not v['vi'].strip(): probs['vocab: thiếu nghĩa'].append(v['w'])
    if v['t'] not in tid: probs['vocab: chủ đề không tồn tại'].append((v['w'], v['t']))
    if not JP.search(v['w']): probs['vocab: từ không có chữ Nhật'].append(v['w'])
    if v['r'] and re.search(r'[一-鿿]', v['r']): probs['vocab: cách đọc chứa Kanji'].append((v['w'], v['r']))
    if re.search(r'[a-zà-ỹ]', v['r'] or ''): probs['vocab: cách đọc lẫn chữ Latin'].append((v['w'], v['r']))
    if re.search(r'[一-鿿]', v['w']) and not v['r']: probs['vocab: Kanji nhưng thiếu cách đọc'].append(v['w'])
dup = collections.Counter((v['w'], v['r'], v['t']) for v in V)
probs['vocab: trùng trong cùng chủ đề'] = [k for k, n in dup.items() if n > 1]
for k in K:
    if not k['hv']: probs['kanji: thiếu Hán Việt'].append(k['k'])
    if not k['words']: probs['kanji: không có từ ghép'].append(k['k'])
    for w in k['words']:
        if k['k'] not in w['w']: probs['kanji: từ ghép không chứa chữ'].append((k['k'], w['w']))
def chk(where, a, ds, s=None):
    opts = [a] + list(ds)
    if len(ds) != 3: probs[where + ': không đủ 3 đáp án nhiễu'].append(s or a)
    if any(not str(o).strip() for o in opts): probs[where + ': đáp án rỗng'].append(s or a)
    if len(set(opts)) != len(opts): probs[where + ': đáp án trùng nhau'].append((s or '')[:40] + ' | ' + ' / '.join(opts))
for g in G:
    for q in g['q']:
        chk('ngữ pháp', q['a'], q['d'], q['s'])
        if q['s'].count('（　　）') != 1: probs['ngữ pháp: không có đúng 1 chỗ trống'].append(q['s'])
        for d in q['d']:
            if d and q['s'].replace('（　　）', d) == q['s'].replace('（　　）', q['a']): probs['ngữ pháp: đáp án nhiễu cũng đúng'].append(q['s'])
for s in S:
    chk('mẫu câu', s['a'], s['d'], s['s'])
    if s['kind'] == '文脈規定' and s['s'].count('（　　）') != 1: probs['mẫu câu: không có đúng 1 chỗ trống'].append(s['s'])
    if s['kind'] == '言い換え' and not re.search(r'［.+?］', s['s']): probs['mẫu câu: thiếu phần gạch chân'].append(s['s'])
for r in R:
    n = len(re.findall(r'【\d】', r['text']))
    if n != len(r['blanks']): probs['đọc hiểu: số chỗ trống ≠ số câu'].append((r['id'], n, len(r['blanks'])))
    for b in r['blanks']: chk('đọc hiểu (chỗ trống)', b['a'], b['d'], r['id'])
    for q in r['questions']: chk('đọc hiểu (câu hỏi)', q['a'], q['d'], r['id'])
gq = sum(len(g['q']) for g in G)
print('vocab %d · kanji %d · grammar %d (câu hỏi %d) · mẫu câu %d · đọc hiểu %d' % (len(V), len(K), len(G), gq, len(S), len(R)))
bad = {k: v for k, v in probs.items() if v}
for k, v in bad.items(): print('-', k, len(v), v[:6])
print('OK' if not bad else 'CÓ LỖI'); sys.exit(1 if bad else 0)
