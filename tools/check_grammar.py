#!/usr/bin/env python3
"""Check grammar data: Vietnamese spelling (syllable by syllable) and question sanity.
usage: python3 tools/check_grammar.py [data/grammar.json | tools/grammar_more.txt ...]
Spelling: every Vietnamese word is split into onset + rhyme after removing the tone mark; the rhyme must be a real
Vietnamese rhyme and a syllable may carry one tone mark only. Words with f/j/w/z or Latin abbreviations are skipped.
Questions: one blank, 4 different non-empty options, answer not among the wrong ones, a wrong option that is another
form of the same pattern (likely a second correct answer) is reported for review."""
import sys, re, json, unicodedata, collections

TONES = {'̀', '́', '̃', '̉', '̣'}
ONSETS = sorted('b c ch d đ g gh gi h k kh l m n ng ngh nh p ph qu r s t th tr v x'.split(), key=len, reverse=True)
RHYMES = set('''a ai ao au ay ac ach am an ang anh ap at ă ăc ăm ăn ăng ăp ăt â âc âm ân âng âp ât âu ây
e ec em en eng eo ep et ê êch êm ên ênh êp êt êu i ia ich im in inh ip it iu iêc iêm iên iêng iêp iêt iêu
o oa oac oach oai oam oan oang oanh oao oap oat oay oăc oăm oăn oăng oăt oc oe oen oeo oet oi om on ong oong op ot
ô ôc ôi ôm ôn ông ôp ôt ơ ơi ơm ơn ơp ơt u ua uân uâng uât uây uc uê uênh uêch uêt uy uya uych uyên uyêt uynh uyp uyt uyu
ui um un ung up ut uô uôc uôi uôm uôn uông uôt ư ưa ưc ưi ưm ưn ưng ươ ươc ươi ươm ươn ương ươp ươt ươu ưt ưu
y yêm yên yêng yêt yêu uơ oo'''.split())
WORD = re.compile(r"[A-Za-zÀ-ỹĐđ]+")

def strip_tone(w):
    d = unicodedata.normalize('NFD', w); tones = sum(1 for ch in d if ch in TONES)
    return unicodedata.normalize('NFC', ''.join(ch for ch in d if ch not in TONES)), tones

def bad_syllable(w):
    if re.search(r'[fjwzFJWZ]', w) or (w.isupper() and len(w) > 1) or not re.search(r'[À-ỹĐđ]', w) and len(w) <= 3:
        return None                                   # foreign word / abbreviation / short ascii (N, V, A, ok)
    base, tones = strip_tone(w.lower())
    if tones > 1: return 'hai dấu thanh'
    if not re.search(r'[À-ỹĐđ]', w) and not re.fullmatch(r'[a-z]+', base): return None
    on = next((o for o in ONSETS if base.startswith(o) and base[len(o):]), '')
    rh = base[len(on):]
    if on == 'gi' and (rh in RHYMES or ('i' + rh) in RHYMES): return None
    if on == 'qu' and (rh in RHYMES or ('u' + rh) in RHYMES): return None
    if rh in RHYMES: return None
    if not re.search(r'[À-ỹĐđ]', w): return None       # plain ascii word that is not Vietnamese (e.g. romaji)
    return 'vần lạ "%s"' % rh

def spell(text):
    return [(w, r) for w in WORD.findall(text) for r in [bad_syllable(w)] if r]

def check_q(p, s, a, ds, where, out):
    if s.count('（　　）') != 1: out.append((where, 'câu phải có đúng 1 chỗ trống: ' + s))
    opts = [a] + ds
    if len(ds) != 3 or len(set(opts)) != 4 or any(not o.strip() for o in opts): out.append((where, 'cần 4 lựa chọn khác nhau: ' + ' / '.join(opts)))
    cores = [c for c in re.split(r'[／・、（）()〜~＋+\s「」…]+', p) if c]
    pre = s.split('（　　）')[0][-3:] if '（　　）' in s else ''
    for o in opts:                                     # option repeating the text just before the blank (病気の【病気のため】)
        if len(pre) >= 2 and o.startswith(pre[-2:]) and not a.startswith(pre[-2:]): out.append((where, 'lựa chọn "%s" lặp lại chữ trước chỗ trống: %s' % (o, s)))
    for d in ds:                                       # wrong option that is a listed variant of the same pattern
        if d in cores and d != a: out.append((where, 'đáp án nhiễu "%s" cũng là một dạng của mẫu %s: %s' % (d, p, s)))

def main(paths):
    issues = []
    for path in paths:
        if path.endswith('.json'):
            for g in json.load(open(path, encoding='utf-8')):
                for k in ('mean',): issues += [(g['id'] + ' ' + k, 'chính tả "%s": %s' % (w, r)) for w, r in spell(g.get(k, ''))]
                for k, v in (g.get('th') or {}).items():
                    if k != 'form': issues += [(g['id'] + ' th.' + k, 'chính tả "%s": %s' % (w, r)) for w, r in spell(v)]
                for e in g['ex']: issues += [(g['id'] + ' ex', 'chính tả "%s": %s' % (w, r)) for w, r in spell(e.get('vi', ''))]
                for i, q in enumerate(g['q']):
                    where = '%s.%d %s' % (g['id'], i, g['p'])
                    check_q(g['p'], q['s'], q['a'], q['d'], where, issues)
                    issues += [(where, 'chính tả "%s": %s' % (w, r)) for w, r in spell(q.get('vi', ''))]
        else:
            for n, l in enumerate(open(path, encoding='utf-8'), 1):
                l = l.rstrip('\n'); f = l.split('|')
                if not l or l.startswith('#'): continue
                where = '%s:%d' % (path.rsplit('/', 1)[-1], n)
                want = {'Q': 5, 'E': 4, 'P': 8, 'T': 5}.get(f[0])
                if want is None or len(f) != want: issues.append((where, 'sai số trường (%d): %s' % (len(f), l[:90]))); continue
                if f[0] in ('Q', 'P'):
                    sent, tr, ds = (f[2], f[3], f[4]) if f[0] == 'Q' else (f[5], f[6], f[7])
                    m = re.search(r'【(.+?)】', sent)
                    if not m or sent.count('【') != 1: issues.append((where, 'thiếu / thừa 【】: ' + sent)); continue
                    check_q(f[1] if f[0] == 'Q' else f[2], sent.replace(m.group(0), '（　　）'), m.group(1), ds.split(';'), where, issues)
                    issues += [(where, 'chính tả "%s": %s' % (w, r)) for w, r in spell(tr)]
                else:
                    issues += [(where, 'chính tả "%s": %s' % (w, r)) for w, r in spell(' '.join(f[2:]))]
    by = collections.Counter(i[1].split(' ')[0] for i in issues)
    for w, msg in issues: print(w, '|', msg)
    print('\n%d vấn đề: %s' % (len(issues), dict(by)))
    return issues

if __name__ == '__main__': main(sys.argv[1:] or ['data/grammar.json'])
