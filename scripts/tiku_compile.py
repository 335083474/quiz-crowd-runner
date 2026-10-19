"""Compile answer-backed text questions. Never infer missing keys or reconstruct figures."""
from pathlib import Path
import json,re,bisect
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'artifacts'/'tiku';OUT=ROOT/'public'/'banks';OUT.mkdir(parents=True,exist_ok=True)
inventory=json.loads((RAW/'inventory.json').read_text(encoding='utf-8'))
AD=[r'考前绝密包过押题加微信\w+获取',r'金融类押题认准微信\d+',r'金融类押题LK.*',r'刷题软件金考典.*',r'全真机考、在线考试.*',r'咨询热线.*',r'扫二维码下载.*',r'移动学习职达未来.*',r'考证就上233网校APP.*',r'免费题库，复习资料包.*',r'扫码下载即可获得.*',r'LC命中率高.*',r'（欢迎扫码关注.*',r'辅导公众号）.*']
Q=re.compile(r'(?m)^\s*(\d{1,3})\s*[、.．)）]\s*(?!\d)')
OPT=re.compile(r'(?:^|\n)\s*([A-F])\s*[.．、:：]\s*')
ANSWER=re.compile(r'(?:参考答案|正确答案|【答案】|答案)\s*[:：]?\s*([A-D](?:\s*[、,，]?\s*[A-D])*|正确|错误|对|错|√|×)')
EXPLAIN=re.compile(r'(?:【[^】]*解析】|解析)\s*[:：]?')
def clean(text):
    for pattern in AD:text=re.sub(pattern,'',text)
    text=re.sub(r'(?m)^\s*(?:扫码关注|报考资讯|公众号|环球网校移动课堂APP|环球网校侵权必究|全班次网课.*|模考押题班.*|精讲冲刺真题.*)\s*$', '', text)
    text=re.sub(r'(?m)^\s*\d*\s*精讲冲刺真题.*$', '', text)
    text=re.sub(r'(?m)^\s*\d+\s*/\s*\d+\s*$','',text)
    text=re.sub(r'=== PAGE \d+ ===','',text)
    return text
def compact(text):return re.sub(r'\s+','',text).strip()
def answer_value(value):
    value=re.sub(r'[\s、,，]','',value)
    if value in ('正确','对','√'):return 0
    if value in ('错误','错','×'):return 1
    values=sorted(set('ABCD'.index(c) for c in value if c in 'ABCD'))
    return values[0] if len(values)==1 else values if values else None
catalog=[];report=[]
for entry in inventory:
    original=(RAW/entry['textFile']).read_text(encoding='utf-8');text=clean(original)
    original_positions=[m.start() for m in re.finditer(r'\S',original)]
    normalized_original=''.join(original[i] for i in original_positions)
    # Separate numbered answer/analysis sections (common in 2025 papers).
    key_pattern=re.compile(r'(?m)^\s*(\d{1,3})\s*(?:[、.．]\s*)?(?:参考)?答案\s*[:：]\s*([A-D](?:\s*[、,，]?\s*[A-D])*|正确|错误|对|错)')
    keys={};key_matches=list(key_pattern.finditer(text))
    for j,m in enumerate(key_matches):
        end=key_matches[j+1].start() if j+1<len(key_matches) else len(text)
        exp=text[m.end():end];mark=EXPLAIN.search(exp)
        keys[int(m[1])]={'answer':answer_value(m[2]),'explanation':compact(exp[mark.end():]) if mark else ''}
    matches=list(Q.finditer(text));questions=[];skips={};used=set()
    material_start=re.search(r'共享题干题|【题干】',text)
    def skip(reason):skips[reason]=skips.get(reason,0)+1
    for j,m in enumerate(matches):
        if material_start and m.start()>material_start.start():skip('共享材料题待单独编排');continue
        number=int(m[1]);block=text[m.end():matches[j+1].start() if j+1<len(matches) else len(text)].strip()
        if not block or re.match(r'^(?:[A-D]\s*){1,4}\s*$',block):continue
        ans=ANSWER.search(block);ex=EXPLAIN.search(block);cut=min([x.start() for x in (ans,ex) if x]+[len(block)])
        body=block[:cut];opts=list(OPT.finditer(body))
        origin='inline_answer';answer=answer_value(ans[1]) if ans else None
        explanation=compact(block[ex.end():]) if ex else ''
        explanation=re.split(r'共享题干题|【题干】|(?:多项选择题|单项选择题|判断题)$',explanation)[0]
        if opts:
            if len(opts) not in (2,4) or ''.join(o[1] for o in opts) not in ('AB','ABCD'):skip('选项结构待校对');continue
            prompt=body[:opts[0].start()];options=[compact(body[o.end():opts[k+1].start() if k+1<len(opts) else len(body)]) for k,o in enumerate(opts)]
            if answer is None:
                marked=[i for i,o in enumerate(options) if re.search(r'[√✔✓]$',o)]
                if marked:answer=marked[0] if len(marked)==1 else marked;origin='option_marks';options=[re.sub(r'[√✔✓]$','',o) for o in options]
            if answer is None and number in keys:answer=keys[number]['answer'];explanation=keys[number]['explanation'];origin='numbered_answer_key'
        elif answer is not None and ans and ans[1] in ('正确','错误','对','错','√','×'):
            prompt=body;options=['正确','错误'];origin='inline_judgment'
        else:
            if re.search(r'[A-D][.．、]',block):skip('版式待整理')
            continue
        if answer is None:skip('缺少原文答案');continue
        prompt=compact(re.sub(r'^(?:\[|【)(?:单选题|多选题|单项选择题|多项选择题|判断题)(?:\]|】)','',prompt))
        if any(term in prompt for term in ['如下图','如图所示','下图','上图','下表','根据上述','根据以上','上述资料','据此回答','根据资料']) or all(re.fullmatch(r'[①②③④⑤⑥]+',o) for o in options):skip('依赖图表或材料');continue
        if len(prompt)<5 or len(prompt)>1000 or any(not o or len(o)>300 for o in options) or len(explanation)>3000:skip('内容不完整或过长');continue
        if any(s in prompt for s in ['参考答案','答案解析','【答案】']):skip('版式待整理');continue
        combined=' '.join([prompt,*options,explanation])
        if re.search(r'参考答案|【答案】|全班次|精讲冲刺|模考押题|扫码|公众号|网校|http[s]?://',combined):skip('跨题或页眉残留待校对');continue
        if any(re.search(r'[A-D][.．、]',o) for o in options):skip('选项合并待校对');continue
        values=answer if isinstance(answer,list) else [answer]
        if not values or any(i>=len(options) for i in values):skip('答案与选项不匹配');continue
        signature=(prompt,tuple(options))
        if signature in used:continue
        used.add(signature)
        # Page number is located against the original prompt prefix; unknown is retained as null.
        prefix=prompt[:16];normalized_position=normalized_original.find(prefix);position=original_positions[normalized_position] if normalized_position>=0 else -1;page=None
        if position>=0:
            previous=list(re.finditer(r'=== PAGE (\d+) ===',original[:position]));page=int(previous[-1][1]) if previous else 1
        questions.append(dict(id=f"{entry['id']}-q-{len(questions)+1}",type='multiple' if isinstance(answer,list) else 'boolean' if len(options)==2 else 'single',topic=entry['subject'],prompt=prompt,options=options,answer=answer,explanation=explanation,source=dict(file=entry['filename'],sha256=entry['sha256'],number=number,page=page,answerOrigin=origin)))
    if len(questions)>200:questions=questions[:200];skip('超过单卷200题上限')
    state='ready' if questions else 'scanned' if entry['chars']<entry['pages']*80 else 'missing_answers' if not entry['answerMarkers'] else 'needs_review'
    bank=dict(id=entry['id'],name=entry['name'],subject=entry['subject'],year=entry['year'],sourceFile=entry['filename'],sourceHash=entry['sha256'],pages=entry['pages'],count=len(questions),types={kind:sum(q['type']==kind for q in questions) for kind in ('single','multiple','boolean')},status=state,skipped=skips,aiProcessed=0)
    (OUT/f"{entry['id']}.json").write_text(json.dumps(dict(**bank,questions=questions),ensure_ascii=False,indent=2),encoding='utf-8')
    catalog.append(bank);report.append(dict(id=entry['id'],name=entry['name'],count=len(questions),status=state,skipped=skips))
(OUT/'index.json').write_text(json.dumps(dict(version=1,items=catalog),ensure_ascii=False,indent=2),encoding='utf-8')
(RAW/'compile-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(files=len(catalog),ready=sum(b['status']=='ready' for b in catalog),questions=sum(b['count'] for b in catalog),bySubject={s:sum(b['count'] for b in catalog if b['subject']==s) for s in sorted(set(b['subject'] for b in catalog))},blocked=[{'id':b['id'],'name':b['name'],'status':b['status']} for b in catalog if not b['count']]),ensure_ascii=False))
