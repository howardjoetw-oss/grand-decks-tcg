#!/usr/bin/env python3
"""Best-effort discovery of set labels on the public TOP DECKS cards index.

Only checks published series labels; no full-site scraping, art or rules copied.
Robots must be readable and allow the page; otherwise skip. The result is a
candidate set watchlist, not proof of a complete or licensed card catalogue.
"""
import json
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.robotparser import RobotFileParser

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'data' / 'topdecks-sets.json'
STATUS = ROOT / 'public' / 'data' / 'sync-status.json'
PAGE = 'https://onepiecetopdecks.com/cards/'
UA = 'GrandDecksSetMonitor/0.3 (fan project; check series labels only)'
PATTERN = re.compile(r'(?<![A-Z0-9])(?:OP\s*-?\s*\d{1,2}|EB\s*-?\s*\d{1,2}|ST\s*-?\s*\d{1,2}|PRB\s*-?\s*\d{1,2})(?![0-9])',re.I)

class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__();self.parts=[];self.omit=0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style'):self.omit+=1
    def handle_endtag(self,tag):
        if tag in ('script','style') and self.omit:self.omit-=1
    def handle_data(self,s):
        if not self.omit:self.parts.append(s)


def parse_series(html):
    p=TextOnly();p.feed(html)
    labels=[]
    for match in PATTERN.finditer(' '.join(p.parts)):
        label=re.sub(r'\s*-?\s*','',match.group().upper())
        if label not in labels:labels.append(label)
    # Deduplicate and sort by class/number (the source may list future sets).
    return sorted(labels,key=lambda v:(re.match('[A-Z]+',v).group(),int(re.search(r'\d+',v).group())))


def check_permitted():
    req=urllib.request.Request('https://onepiecetopdecks.com/robots.txt',headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=15) as response:
        if response.status!=200:raise ValueError('robots.txt returned non-200 status')
        txt=response.read(100000).decode('utf-8','replace')
    rp=RobotFileParser();rp.parse(txt.splitlines())
    if not rp.can_fetch(UA,PAGE):raise PermissionError('robots.txt did not permit access')


def report(state,count=0,message=''):
    data={}
    try:data=json.loads(STATUS.read_text('utf-8'))
    except (OSError,ValueError):pass
    data['topDecksSets']={'state':state,'checkedAt':datetime.now(timezone.utc).isoformat(),
                          'seriesCount':count,'url':PAGE,'message':str(message)[:240]}
    STATUS.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')


def main():
    try:
        check_permitted()
        req=urllib.request.Request(PAGE,headers={'User-Agent':UA,'Accept':'text/html'})
        with urllib.request.urlopen(req,timeout=25) as response:
            html=response.read(2_000_000).decode('utf-8','replace')
        labels=parse_series(html)
        if len(labels)<10:raise ValueError('Too few series labels to trust the source layout')
        original={}
        try:original=json.loads(OUT.read_text('utf-8'))
        except (OSError,ValueError):pass
        state='unchanged' if original.get('series')==labels else 'updated'
        if state=='updated':
            OUT.write_text(json.dumps({'checkedAt':datetime.now(timezone.utc).isoformat(),
                 'source':PAGE,'series':labels},ensure_ascii=False,indent=2),encoding='utf-8')
        report(state,len(labels))
        print(f'TOP DECKS set index check: {state} / {len(labels)} labels')
    except Exception as exc:
        count=0
        try:count=len(json.loads(OUT.read_text('utf-8')).get('series',[]))
        except (OSError,ValueError):pass
        report('failed',count,exc)
        raise

if __name__=='__main__':main()
