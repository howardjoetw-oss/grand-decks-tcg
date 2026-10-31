"""Validated static data model for GRAND DECKS. No network operations."""
from collections import defaultdict
from datetime import date, datetime, timezone
import hashlib
import json
import re

CARD_ID = re.compile(r'^(?:OP\d{2}|EB\d{2}|ST\d{2}|PRB\d{2}|P)-\d{2,4}$', re.I)
REGIONS = {'JP':'JP', 'TW':'TW','HK':'ASIA','CN':'ASIA','KR':'ASIA','SG':'ASIA','MY':'ASIA','TH':'ASIA','PH':'ASIA','ID':'ASIA','US':'NA','CA':'NA','MX':'NA','GB':'EU','DE':'EU','FR':'EU','ES':'EU','IT':'EU','NL':'EU','PL':'EU','BE':'EU'}


def canonical_id(identifier):
    c = str(identifier or '').strip().upper().split('_')[0]
    return c if CARD_ID.fullmatch(c) else ''


def validate_deck(row):
    """Returns (normalized, errors); incomplete source lists are allowed but cannot be imported."""
    errors=[]
    if not isinstance(row,dict): return None, ['非物件']
    r=dict(row)
    if not isinstance(r.get('id'),str) or not r['id'].strip():errors.append('缺少穩定結果 ID')
    if not isinstance(r.get('sourceUrl'),str) or not r['sourceUrl'].startswith('https://'):errors.append('來源必須是 HTTPS URL')
    if not isinstance(r.get('sourceType'),str) or r['sourceType'] not in ('platform_result','source_reported','community_claim'):errors.append('未知證據層級')
    if not canonical_id(r.get('leaderId')):errors.append('領航員卡號無效')
    try:date.fromisoformat(str(r.get('date',''))[:10])
    except ValueError:errors.append('日期無效')
    raw=r.get('cards') or {}
    if not isinstance(raw,dict):raw={};errors.append('牌組清單格式無效')
    items={}
    for k,n in raw.items():
        cid=canonical_id(k)
        if not cid or not isinstance(n,int) or isinstance(n,bool) or n<1 or n>4:
            errors.append('牌組卡號或數量無效');continue
        items[cid]=items.get(cid,0)+n
    if any(n>4 for n in items.values()):errors.append('相同卡號超過四張')
    r['cards']=dict(sorted(items.items()))
    r['cardCount']=sum(items.values())
    r['complete']=r['cardCount']==50 and not any('牌組' in s for s in errors)
    leader=canonical_id(r.get('leaderId'))
    r['leaderId']=leader
    r['region']=REGIONS.get(str(r.get('country','')).upper(), 'OTHER')
    r['formatKey']=str(r.get('formatKey') or '未指定賽制')[:60]
    if r['complete'] and leader:
        serial=json.dumps([leader,list(r['cards'].items())],separators=(',',':'),ensure_ascii=True)
        r['fingerprint']=hashlib.sha256(serial.encode()).hexdigest()[:18]
    else:r['fingerprint']=None
    rank=r.get('placing')
    if rank is not None and (not isinstance(rank,int) or rank<1):errors.append('排名無效')
    for k in ('wins','losses','ties'):
        v=r.get(k)
        if v is not None and (not isinstance(v,int) or isinstance(v,bool) or v<0):errors.append('戰績無效')
    r['verifiedPlatform']=r.get('sourceType')=='platform_result'
    return r,errors


def consolidate(rows):
    """Keep independent entries for multiple tournament results; dedup same result ID."""
    unique={}; rejected=[]
    for row in rows:
        obj,errors=validate_deck(row)
        if errors:rejected.append({'id':str((row or {}).get('id',''))[:70], 'errors':errors});continue
        if obj['id'] not in unique or (obj['complete'] and not unique[obj['id']]['complete']):unique[obj['id']]=obj
    clean=sorted(unique.values(),key=lambda x:(x['date'],x.get('placing') or 999),reverse=True)
    return clean,rejected


def aggregate(rows,days=30,region='ALL',today=None):
    """Top-cut *coverage*, not tournament population winrate or matchup winrate."""
    today=today or datetime.now(timezone.utc).date()
    filtered=[]
    for x in rows:
        if x.get('sourceType') not in ('platform_result','source_reported'):continue
        place=x.get('placing')
        if not isinstance(place,int) or place<1 or place>8:continue
        if region!='ALL' and x.get('region')!=region:continue
        try:d=date.fromisoformat(x['date'][:10])
        except (KeyError,ValueError,TypeError):continue
        if days and not (0<=(today-d).days<days):continue
        filtered.append(x)
    groups=defaultdict(lambda:{'entries':0,'champions':0,'events':set(),'lastDate':''})
    for x in filtered:
        id=x.get('leaderId','')
        if not id:continue
        g=groups[id]
        g['entries']+=1
        if x.get('placing')==1:g['champions']+=1
        event_key=x.get('source','')+'|'+x.get('date','')+'|'+x.get('event','')
        g['events'].add(event_key)
        g['lastDate']=max(g['lastDate'],x.get('date',''))
    out=[]; denominator=len(filtered)
    for cid,v in groups.items():
        out.append({'leaderId':cid,'topCutCount':v['entries'],'championCount':v['champions'], 'distinctEventCount':len(v['events']),
                    'lastDate':v['lastDate'],'topCutShare':round(v['entries']/denominator*100,2) if denominator else 0,
                    'numerator':v['entries'],'denominator':denominator})
    out.sort(key=lambda x:(-x['topCutCount'],-x['championCount'],x['leaderId']))
    return {'days':days,'region':region,'sampleCount':denominator,'uniqueLeaders':len(out),
            'sampleWarning':denominator<20,'formatWarning':len({x.get('formatKey','未指定賽制') for x in filtered})!=1 or any(x.get('formatKey','未指定賽制')=='未指定賽制' for x in filtered),'definition':'本站已收錄之賽事前八牌組佔比；不是全場使用率、個人勝率或對戰勝率', 'leaders':out}
