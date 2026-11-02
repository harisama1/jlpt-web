#!/usr/bin/env python3
"""Build local/exams/<id>/exam.json + local/exams/index.json from local/exams/<id>/exam.txt.
The exams are copyrighted course material, so local/ is git-ignored and only this converter is in the repo.

exam.txt format (one item per line, blank lines and lines starting with ';' ignored):
  @title <text>            @note <text>
  # <part id> | <part name>
  ## <instructions of a group (問題1 …)>
  > <passage line>         (several lines are joined with newlines)
  & <audio file>           ! <image file>          (attach to the current group, or to the last Q if it has none yet: use +& / +!)
  Q <n> | <question, ［underlined］> | o1 | o2 | o3 | o4 | <answer 1-4> | <why (Vietnamese)>
  Q <n> | -   or   Q <n> | <text> | -      (item missing from the source)
  +& <audio>   +! <image>   +vi <translation>   +s <transcript line>   (add to the last Q)
Audio may be a slice of one long file: "full.mp3#t=186,246" (seconds). If local/exams/<id>/transcript.txt exists
(output of ~/tools/stt/transcribe.py: "## <file>" then "[mm:ss.xx] text" lines), each item with audio and no +s gets the
transcript lines of its file (only the lines inside the #t= slice when there is one).
usage: python3 tools/build_exams.py"""
import json, os, glob, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'local', 'exams')


def parse(path):
    ex = {'id': os.path.basename(os.path.dirname(path)), 'title': '', 'note': '', 'parts': []}
    part = group = q = None
    for ln, raw in enumerate(open(path, encoding='utf-8'), 1):
        l = raw.rstrip('\n')
        if not l.strip() or l.startswith(';'):
            continue
        tag, _, rest = l.partition(' ')
        rest = rest.strip()
        if tag == '@title': ex['title'] = rest
        elif tag == '@note': ex['note'] = rest
        elif tag == '#':
            pid, _, name = rest.partition('|')
            part = {'id': pid.strip(), 'name': name.strip(), 'groups': []}; ex['parts'].append(part); group = q = None
        elif tag == '##':
            group = {'title': rest, 'items': []}; part['groups'].append(group); q = None
        elif tag in ('>', '&', '!'):
            if group is None or group['items']:   # passage / media after items starts a new untitled group
                group = {'title': '', 'items': []}; part['groups'].append(group); q = None
            if tag == '>': group['passage'] = (group.get('passage', '') + '\n' + rest).lstrip('\n')
            else: group.setdefault('audio' if tag == '&' else 'img', []).append(rest)
        elif tag == 'Q':
            f = [x.strip() for x in rest.split('|')]
            if len(f) <= 3 and f[-1] == '-':          # "Q n | -" or "Q n | text | -"
                q = {'n': int(f[0]), 'q': f[1] if len(f) == 3 else '', 'opts': [], 'a': -1, 'missing': True}
            else:
                if len(f) < 7: raise SystemExit(f'{path}:{ln}: Q needs n|q|o1|o2|o3|o4|answer[|why]')
                q = {'n': int(f[0]), 'q': f[1], 'opts': f[2:6], 'a': int(f[6]) - 1}
                if len(f) > 7 and f[7]: q['why'] = f[7]
                if not 0 <= q['a'] < 4: raise SystemExit(f'{path}:{ln}: answer must be 1-4')
            if group is None: group = {'title': '', 'items': []}; part['groups'].append(group)
            group['items'].append(q)
        elif tag in ('+&', '+!', '+vi', '+s'):
            key = {'+&': 'audio', '+!': 'img', '+vi': 'vi', '+s': 'script'}[tag]
            if key in ('audio', 'img'): q.setdefault(key, []).append(rest)
            else: q[key] = (q.get(key, '') + '\n' + rest).lstrip('\n')
        else:
            raise SystemExit(f'{path}:{ln}: unknown line: {l[:40]}')
    return ex


def load_transcript(path):
    tr, cur = {}, None
    if not os.path.exists(path): return tr
    for l in open(path, encoding='utf-8'):
        if l.startswith('## '): cur = tr.setdefault(l[3:].strip(), [])
        else:
            m = re.match(r'\[(\d+):(\d+\.\d+)\] (.*)', l)
            if m and cur is not None: cur.append((int(m[1]) * 60 + float(m[2]), m[3].strip()))
    return tr


def add_scripts(ex, tr):
    for pt in ex['parts']:
        for g in pt['groups']:
            for it in g['items']:
                if it.get('script') or not it.get('audio'): continue
                f, _, frag = it['audio'][0].partition('#t=')
                lines = tr.get(os.path.basename(f), [])
                if frag:
                    a, b = (float(x) for x in frag.split(','))
                    lines = [x for x in lines if a - 1 <= x[0] < b]
                if lines: it['script'] = '\n'.join(t for _, t in lines)


def main():
    index = []
    for p in sorted(glob.glob(os.path.join(ROOT, '*', 'exam.txt'))):
        ex = parse(p)
        add_scripts(ex, load_transcript(os.path.join(os.path.dirname(p), 'transcript.txt')))
        out = os.path.join(os.path.dirname(p), 'exam.json')
        json.dump(ex, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        n = sum(len(g['items']) for pt in ex['parts'] for g in pt['groups'])
        miss = sum(1 for pt in ex['parts'] for g in pt['groups'] for it in g['items'] if it.get('missing'))
        index.append({'id': ex['id'], 'title': ex['title'], 'file': ex['id'] + '/exam.json'})
        print(f"{ex['id']}: {len(ex['parts'])} parts, {n} items ({miss} missing)")
    json.dump(index, open(os.path.join(ROOT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
