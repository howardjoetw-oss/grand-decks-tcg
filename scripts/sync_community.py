"""Optional, allowlisted public RSS/Atom watch, no API keys or paid services.

Feeds must be explicitly configured in config/community_feeds.json. Never
promote entries to verified tournament wins; ignore all player winrate claims.
"""
import hashlib
import json
import re
import urllib.request
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'public'/'data'/'community.json'
CONFIG=ROOT/'config'/'community_feeds.json'; UA='GrandDecksCommunityRSS/0.1 (public-source monitor; no paid API)'

def title_text(v):return re.sub(r'\s+',' ',v or '').strip()[:170]

def entries(xml):
    root=ET.fromstring(xml)
    out=[]
    if root.tag.endswith('rss') or root.tag.endswith('RDF'):
        for node in root.findall('.//item')[:50]:
            out.append({'title':title_text(node.findtext('title')),'url':title_text(node.findtext('link')),'date':title_text(node.findtext('pubDate'))})
    else:
        ns={'a':'http://www.w3.org/2005/Atom'}
        for node in root.findall('.//a:entry',ns)[:50]:
            link=next((x.get('href') for x in node.findall('a:link',ns) if x.get('rel','alternate')=='alternate'),None)
            out.append({'title':title_text(node.findtext('a:title','',ns)),'url':title_text(link),'date':title_text(node.findtext('a:updated','',ns))})
    return [x for x in out if x['title'] and x['url'].startswith('https://')]

def allowed(url):
    u=urlparse(url)
    if u.scheme!='https' or not u.hostname or u.username or u.password:return False
    rp=RobotFileParser()
    try:
        req=urllib.request.Request(f'https://{u.hostname}/robots.txt',headers={'User-Agent':UA})
        with urllib.request.urlopen(req,timeout=12) as r:
            if r.status!=200:return False
            rp.parse(r.read(100000).decode('utf-8','replace').splitlines())
        return rp.can_fetch(UA,url)
    except Exception:return False

def collect(feed_configs,fetch):
    out={}
    for f in feed_configs:
        url=f.get('url','')
        if not f.get('approved') or not allowed(url):
            print('Skipping unapproved/disallowed RSS',url);continue
        for item in entries(fetch(url)):
            if urlparse(item['url']).scheme!='https':continue
            uid=hashlib.sha256(item['url'].encode()).hexdigest()[:18]
            out[uid]={'id':'feed:'+uid,'title':item['title'],'sourceUrl':item['url'],'sourceName':str(f.get('title','公開來源'))[:80],
                'date':item['date'],'status':'unverified','evidence':'僅供社群情報搜尋，尚無獨立可核實賽事成績'}
    return list(out.values())

def main():
    config=json.loads(CONFIG.read_text('utf-8'))
    feeds=config.get('feeds',[])
    if not feeds:print('No approved community feeds configured; retaining existing snapshot.');return
    def fetch(url):
        req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/atom+xml,application/rss+xml,application/xml'})
        with urllib.request.urlopen(req,timeout=18) as r:return r.read(1500000)
    new=collect(feeds,fetch)
    if not new:print('No approved readable feed entries; retaining existing snapshot.');return
    old=[]
    try:old=json.loads(DATA.read_text('utf-8')).get('candidates',[])
    except (OSError,ValueError):pass
    seen={r['id']:r for r in old if r.get('id')}
    for n in new:seen[n['id']]=n
    merged=sorted(seen.values(),key=lambda x:x.get('date',''),reverse=True)[:300]
    temp=DATA.with_suffix('.tmp')
    temp.write_text(json.dumps({'schemaVersion':1,'updatedAt':datetime.now(timezone.utc).isoformat(),
       'candidates':merged,'evidence':'所有社群情報均為待查證；不納入賽事上位率計算'},ensure_ascii=False,separators=(',',':')),'utf-8')
    temp.replace(DATA)
    print('Community candidate count',len(merged))
if __name__=='__main__':main()
