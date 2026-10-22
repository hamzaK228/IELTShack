#!/usr/bin/env python3
"""Fill any remaining missing reading questions with an explicit reference prompt.
These are image/table tasks whose wording is not in the text; the answer key is
still applied so every test reaches 40. QA list flags them via prompt text."""
import json,re,glob,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
TESTS=ROOT/'content/tests'
LET='ABCDEFGHIJ'
added_total=0
for f in sorted(TESTS.glob('pte-*reading-*.json')):
    d=json.loads(f.read_text()); reading=[s for s in d['sections'] if s.get('skill')=='reading']
    if not reading: continue
    nums=set()
    for s in reading:
        for q in s['questions']:
            m=re.search(r'q(\d+)$',q['id'])
            if m: nums.add(int(m.group(1)))
    missing=[n for n in range(1,41) if n not in nums]
    if not missing: continue
    # answers from the corresponding page cache
    m=re.match(r'pte-(gt-)?reading-(\d+)$',d['id'])
    if not m: continue
    cache=ROOT/'scripts/.cache'/('gt-reading' if m.group(1) else 'reading')/f'test-{m.group(2)}.html'
    if not cache.exists(): continue
    import html as H
    s=re.sub(r'<script.*?</script>|<style.*?</style>','',cache.read_text(errors='ignore'),flags=re.S)
    s=H.unescape(re.sub(r'<[^>]+>','\n',s))
    lines=[re.sub(r'\s+',' ',l).strip() for l in s.split('\n') if l.strip()]
    ki=[i for i,l in enumerate(lines) if re.match(r'^show\s+an\w*ers$',l,re.I)]
    key={}
    if ki:
        block=[l for l in lines[ki[-1]+1:] if not re.match(r'^(copyright|privacy|disclaimer|terms|contact)',l,re.I)]
        pairs=re.findall(r'^(\d{1,2})\s*[\.\)]\s*(.+)$','\n'.join(block),re.M)
        key={int(n):a.strip() for n,a in pairs} if len(pairs)>=20 else {i+1:v for i,v in enumerate(block[:40])}
    added=0
    for n in missing:
        ans=key.get(n)
        if not ans:
            # The source page itself leaves this key blank. Ship the slot as an
            # ungraded question instead of inventing an answer.
            q={'id':f"{d['id']}-q{n}",'skill':'reading','type':'short','graded':False,
               'prompt':f'Refer to the passage or diagram and answer question {n}. (Answer key unavailable on the source page.)',
               'answer':'','difficulty':2}
            target=None
            for sec in reading:
                ns=[int(re.search(r'q(\d+)$',x['id']).group(1)) for x in sec['questions'] if re.search(r'q(\d+)$',x['id'])]
                if ns and min(ns)<=n<=max(ns): target=sec; break
            if target is None:
                for sec in reversed(reading):
                    ns=[int(re.search(r'q(\d+)$',x['id']).group(1)) for x in sec['questions'] if re.search(r'q(\d+)$',x['id'])]
                    if ns and max(ns)<n: target=sec; break
            target=target or reading[0]
            target['questions'].append(q)
            target['questions'].sort(key=lambda x:int(re.search(r'q(\d+)$',x['id']).group(1)))
            added+=1
            continue
        q={'id':f"{d['id']}-q{n}",'skill':'reading','type':'gap',
           'prompt':f'Refer to the passage or diagram and answer question {n}. ______',
           'answer':str(ans).strip(),'difficulty':2}
        if re.fullmatch(r'[A-J]',str(ans),re.I):
            last=LET.index(str(ans).upper())
            q['type']='matching'; q['options']=[{'id':c,'text':f'Option {c}'} for c in LET[:max(last,1)+1]]
        elif str(ans).lower() in {'true','false','not given','yes','no','ng'}:
            yes=str(ans).lower() in {'yes','no'}
            q['type']='tfng'; q['options']=[{'id':'Yes' if yes else 'True','text':'Yes' if yes else 'True'},{'id':'No' if yes else 'False','text':'No' if yes else 'False'},{'id':'Not Given','text':'Not Given'}]
        target=None
        for sec in reading:
            ns=[int(re.search(r'q(\d+)$',x['id']).group(1)) for x in sec['questions'] if re.search(r'q(\d+)$',x['id'])]
            if ns and min(ns)<=n<=max(ns): target=sec; break
        if target is None:
            for sec in reversed(reading):
                ns=[int(re.search(r'q(\d+)$',x['id']).group(1)) for x in sec['questions'] if re.search(r'q(\d+)$',x['id'])]
                if ns and max(ns)<n: target=sec; break
        target=target or reading[0]
        target['questions'].append(q)
        target['questions'].sort(key=lambda x:int(re.search(r'q(\d+)$',x['id']).group(1)))
        added+=1
    if added:
        f.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
        added_total+=added
        print(f"{d['id']}: +{added} -> 40")
print('added',added_total)
