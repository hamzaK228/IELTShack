#!/usr/bin/env python3
"""Complete listening tests to 40 questions using the cached source pages."""
import json,re,glob,html as H
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
TESTS=ROOT/'content/tests'; CACHE=ROOT/'scripts/.cache/listening'
LET='ABCDEFGHIJ'
def clean(t):
    t=H.unescape(re.sub(r'<[^>]+>',' ',t)); return re.sub(r'\s+',' ',t).strip()
def keymap(lines):
    ki=[i for i,l in enumerate(lines) if re.match(r'^show\s+an\w*ers$',l,re.I)]
    if not ki: return {}
    block=[l for l in lines[ki[-1]+1:] if not re.match(r'^(copyright|privacy|disclaimer|terms|contact)',l,re.I)]
    pairs=re.findall(r'^(\d{1,2})\s*[\.\)]\s*(.+)$','\n'.join(block),re.M)
    if len(pairs)>=20: return {int(n):a.strip() for n,a in pairs}
    return {i+1:v for i,v in enumerate([l for l in block if len(l)<90][:40])}
total_added=0
for f in sorted(glob.glob(str(TESTS/'pte-listening-*.json'))):
    p=Path(f); d=json.loads(p.read_text())
    secs=[s for s in d['sections'] if s.get('skill')=='listening']
    if not secs: continue
    nums=set(int(re.search(r'q(\d+)$',q['id']).group(1)) for s in secs for q in s['questions'] if re.search(r'q(\d+)$',q['id']))
    miss=[n for n in range(1,41) if n not in nums]
    if not miss: continue
    m=re.match(r'pte-listening-(\d+)$',d['id']); cf=CACHE/f'test-{m.group(1)}.html'
    if not cf.exists(): continue
    s=cf.read_text(errors='ignore'); s=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S)
    s=H.unescape(re.sub(r'<[^>]+>','\n',s)); lines=[re.sub(r'\s+',' ',l).strip() for l in s.split('\n') if l.strip()]
    key=keymap(lines); sec=secs[0]; added=0
    for n in miss:
        ans=key.get(n)
        idx=next((i for i,l in enumerate(lines) if re.match(rf'^{n}(?:[\.\):]|\s)\s*\S',l) and not re.match(rf'^{n}\s*[\.\)]?\s*[A-J]$',l)),None)
        text=None
        if idx is not None:
            text=re.sub(rf'^{n}\s*[\.\):]?\s*','',lines[idx])
            text=re.sub(r'^[•o]\s*','',text)
        if not text:
            idx=next((i for i,l in enumerate(lines) if re.search(rf'\(\s*{n}\s*\)\s*[.…_·•]{{2,}}',l)),None)
            if idx is not None:
                ctx=[l for l in lines[max(0,idx-2):idx] if l][-1:]
                text=' · '.join(ctx+[lines[idx]])
        if not ans and not text: continue
        if not ans:
            q={'id':f"{d['id']}-q{n}",'skill':'listening','type':'short','graded':False,
               'prompt':f'Listen to the recording and answer question {n}. (Answer key unavailable on the source page.)',
               'answer':'','difficulty':2}
        else:
            if text:
                prompt=text if re.search(r'[_…]{3,}',text) else f"{text} ______"
                prompt=re.sub(r'^\d+\s*[\.\)]?\s*','',prompt)
            else:
                prompt=f'Listen to the recording and answer question {n}. ______'
            ans=str(ans).strip(); q={'id':f"{d['id']}-q{n}",'skill':'listening','type':'gap','prompt':prompt,'answer':ans,'difficulty':2}
            if re.fullmatch(r'[A-J]',ans,re.I):
                last=LET.index(ans.upper()); q['type']='mcq'
                q['options']=[{'id':c,'text':f'Option {c}'} for c in LET[:max(last,1)+1]]
            elif ans.lower() in {'true','false','not given','yes','no','ng'}:
                yes=ans.lower() in {'yes','no'}
                q['type']='tfng'; q['options']=[{'id':'Yes' if yes else 'True','text':'Yes' if yes else 'True'},{'id':'No' if yes else 'False','text':'No' if yes else 'False'},{'id':'Not Given','text':'Not Given'}]
        sec['questions'].append(q); added+=1
    if added:
        sec['questions'].sort(key=lambda x:int(re.search(r'q(\d+)$',x['id']).group(1)))
        p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n'); total_added+=added
        print(d['id'],'+',added,'->',len(sec['questions']))
print('added',total_added)
