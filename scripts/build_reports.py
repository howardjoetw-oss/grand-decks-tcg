"""Post-sync validation and summaries; never overwrite a valid snapshot with empty failures."""
import json
from pathlib import Path
from datetime import datetime, timezone
from data_model import consolidate,aggregate

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'public'/'data'

def atomic_json(path, obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    target=json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n'
    if path.exists() and path.read_text('utf-8')==target:return False
    temp=path.with_suffix('.tmp')
    temp.write_text(target,'utf-8'); temp.replace(path); return True

def make_report(decks, date_today=None):
    clean,rejected=consolidate(decks)
    # A source can provide summary-only results; do not replace them with fabricated card counts.
    if decks and not clean:raise ValueError('Every deck failed validation: keep previous snapshot')
    windows={}
    for days in (7,30,90,0):
        for region in ('ALL','JP','TW','ASIA','NA','EU','OTHER'):
            windows[f'{days}:{region}']=aggregate(clean,days,region,date_today)
    return clean,rejected,windows

def main():
    data=json.loads((DATA/'decks.json').read_text('utf-8'))
    clean,rejected,windows=make_report(data.get('decks',[]))
    # Validate before writes. Keep original data timestamp if nothing changed.
    if clean != data.get('decks',[]):
        data['decks']=clean
        atomic_json(DATA/'decks.json',data)
    build_at=datetime.now(timezone.utc).isoformat()
    atomic_json(DATA/'meta.json',{'schemaVersion':1,'updatedAt':data.get('updatedAt'), 'definitions':{'topCutShare':'在本站收錄的前八牌組佔比'},'windows':windows})
    # Audit is intentionally aggregate, without copying player names into logs.
    atomic_json(DATA/'integrity.json',{'schemaVersion':1,'checkedAt':build_at,'publishedResults':len(clean),'excludedResults':len(rejected),
        'missingFullDecklists':sum(not x['complete'] for x in clean), 'uniqueDeckFingerprints':len({x['fingerprint'] for x in clean if x['fingerprint']}),
        'warnings':['資料來源收錄不完整；非全球 Meta 真實母體']+(['部分資料驗證未通過，請見 GitHub Action 日誌'] if rejected else [])})
    if rejected:print('Records rejected:',json.dumps(rejected[:10],ensure_ascii=False))
    print(f'Meta calculated for {len(clean)} published results; rejected {len(rejected)}')

if __name__=='__main__':main()
