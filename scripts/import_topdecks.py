#!/usr/bin/env python3
"""Best-effort factual deck-result importer for the 2 OP17 TopDecks pages.
Fetch is guarded by robots.txt (fail closed), rate-limited and DOES NOT fetch card art,
articles or player social profiles. Never bypass blocks or login.
Can also parse a saved HTML file for format tests without making network requests.
"""
import argparse
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
FILE=ROOT/'public'/'data'/'decks.json'
DOMAIN='https://onepiecetopdecks.com'
PAGES=[
 DOMAIN+'/deck-list/japan-op17-deck-list-the-worlds-strongest-warriors/',
 DOMAIN+'/deck-list/english-op17-deck-list-the-worlds-strongest-warriors/',
]
UA='GrandDecksPublicMetaCollector/0.2 (noncommercial fan prototype; factual results only)'
DATE=re.compile(r'^\d{1,2}/\d{1,2}/\d{4}$')
PART=re.compile(r'(\d+)n((?:OP|EB|ST|PRB|P)\d{0,2}-\d{2,4})(?=a|$)')
RANK=re.compile(r'^(1st|2nd|3rd|4th|T4|T8|T16)',re.I)
COUNTRIES={'JP':'JP','Japan':'JP','Singapore':'SG','Malaysia':'MY','Thailand':'TH','Indonesia':'ID','China':'CN','Taiwan':'TW','Hong Kong':'HK','USA':'US','US':'US','NA':'US','Europe':'EU','Brazil':'BR','UAE':'AE'}


def parse_deck(s):
    pairs=PART.findall(s.replace(' ','').replace('\n',''))
    if len(pairs)<4 or int(pairs[0][0])!=1:
        return None
    leader=pairs[0][1].upper()
    cards={}
    for n,cid in pairs[1:]:
        n=int(n);cid=cid.upper()
        if not 1<=n<=4:
            return None
        cards[cid]=cards.get(cid,0)+n
    if sum(cards.values())!=50 or any(n>4 for n in cards.values()):
        return None
    return leader, cards


def parse_html(html,url):
    soup=BeautifulSoup(html,'html.parser')
    output=[]
    for table in soup.select('table'):
        headers=[x.get_text(' ',strip=True).lower().strip() for x in table.select('tr th')]
        # Source's first column has deck code, followed by display fields.
        # HTML table layouts with different headers are skipped, not guessed.
        def field(fields,name,fallback=None):
            indices=[i for i,h in enumerate(headers) if name in h]
            n=indices[0] if indices else fallback
            return fields[n] if n is not None and n<len(fields) else ''
        if not any('date' in h for h in headers) or not any('placement' in h for h in headers):
            continue
        for tr in table.select('tr'):
            tds=tr.find_all('td',recursive=False)
            if len(tds)<8:
                continue
            vals=[c.get_text(' ',strip=True) for c in tds]
            raw=vals[0]
            if not PART.search(raw):
                raw=tds[0].get('data-clipboard-text','')
            composition=parse_deck(raw)
            if not composition:
                continue
            date=field(vals,'date')
            if not DATE.match(date):
                continue
            try: day=datetime.strptime(date,'%m/%d/%Y').date().isoformat()
            except ValueError: continue
            placement=field(vals,'placement')
            m=RANK.search(placement)
            if not m: continue
            placement_map={'1st':1,'2nd':2,'3rd':3,'4th':4,'T4':4,'T8':8,'T16':16}
            rank=placement_map[m.group(1).upper() if m.group(1).upper().startswith('T') else m.group(1).lower()]
            if rank>8: continue
            result=re.search(r'\((\d+)-(\d+)\)',placement)
            lead,cards=composition
            name=field(vals,'deck name') or lead
            country=field(vals,'country')
            player=field(vals,'author') or '未公開'
            event=field(vals,'tournament')
            host=field(vals,'host')
            stable='|'.join([day,player,lead,raw,event,host])
            uid=hashlib.sha256(stable.encode()).hexdigest()[:20]
            output.append({
                'id':'topdecks:'+uid, 'source':'ONE PIECE TOP DECKS', 'sourceType':'source_reported',
                'sourceUrl':url,'date':day,'event':(event+' · '+host).strip(' ·')[:160],
                'players':None,'country':COUNTRIES.get(country,country.upper()[:10]),'player':player[:100],
                'placing':rank,'wins':int(result.group(1)) if result else None,
                'losses':int(result.group(2)) if result else None,'ties':None,
                'leaderId':lead,'leaderName':name[:100], 'cards':cards,'cardCount':sum(cards.values()),
                'evidence':'ONE PIECE TOP DECKS 來源所列之牌組及名次；未跨來源獨立核實，請點來源核對。'
            })
    return output


def permitted(url):
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' or parsed.netloc!='onepiecetopdecks.com':
        return False
    robots_url=DOMAIN+'/robots.txt'
    # Require actual robots.txt 200 and known parse: fail-closed otherwise.
    try:
        request=urllib.request.Request(robots_url,headers={'User-Agent':UA})
        with urllib.request.urlopen(request,timeout=15) as resp:
            if resp.status!=200: return False
            txt=resp.read(100_000).decode('utf-8','replace')
        rp=RobotFileParser();rp.parse(txt.splitlines())
        return rp.can_fetch(UA,url)
    except Exception as exc:
        print('Robots verification unavailable. Skipping TopDecks source:',exc,file=sys.stderr)
        return False


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--html-file',help='Parse user-saved HTML, without any network access')
    ap.add_argument('--url',action='append',help='Explicit page URLs (allow-listed)')
    args=ap.parse_args()
    pages=[]
    if args.html_file:
        pages=[(Path(args.html_file).read_text('utf-8'),PAGES[0])]
    else:
        for url in args.url or PAGES:
            if not permitted(url):
                print('Skipped (robots unavailable/disallowed):',url,file=sys.stderr)
                continue
            request=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html'})
            with urllib.request.urlopen(request,timeout=30) as r:
                data=r.read(5_000_000).decode('utf-8','replace')
            pages.append((data,url))
            time.sleep(3)
    gathered={}
    for html,url in pages:
        rows=parse_html(html,url)
        print('Parsed',len(rows),'full 50-card top 8 rows from',url)
        gathered.update((row['id'],row) for row in rows)
    if not gathered:
        print('No valid full 50-card decklists parsed. Existing data preserved.')
        return
    data=json.loads(FILE.read_text('utf-8'))
    original=data.get('decks',[])
    previous={r['id']:r for r in original if isinstance(r,dict) and r.get('id')}
    # Replace older summary-only entries with complete lists for same player/leader/day/source.
    def signature(row):
        return (row.get('source'), row.get('date'), str(row.get('leaderId','')).upper(), str(row.get('player','')).casefold().strip())
    complete_signatures={signature(v) for v in gathered.values()}
    previous={k:v for k,v in previous.items() if v.get('cardCount')==50 or signature(v) not in complete_signatures}
    previous.update(gathered)
    merged=sorted(previous.values(),key=lambda x:x.get('date',''),reverse=True)[:750]
    if merged==original:
        print('Unchanged');return
    data['decks']=merged
    data['updatedAt']=datetime.now(timezone.utc).isoformat()
    FILE.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),'utf-8')
    print('Updated',FILE,'now',len(merged),'results')

if __name__=='__main__': main()
