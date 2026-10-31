"""Run free source adapters independently; preserve old data and report failures."""
import json
import os
import subprocess
import sys
from datetime import datetime,timezone
from pathlib import Path
from build_reports import atomic_json
ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'public'/'data'
JOBS=[('繁中卡牌索引',['sync_cards.py']),('Limitless Play',['sync_results.py','--days','45','--max-events','32']),
      ('TOP DECKS 系列監看',['check_topdecks_sets.py']),('TOP DECKS 賽事摘要',['import_topdecks.py']),('社群 RSS',['sync_community.py'])]

def main():
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--offline',action='store_true');a=p.parse_args()
    results={}
    for name,cmd in JOBS:
        if a.offline:
            results[name]={'status':'skipped','details':'離線模式未執行遠端取得'};continue
        command=[sys.executable,str(ROOT/'scripts'/cmd[0]),*cmd[1:]]
        try:
            r=subprocess.run(command,text=True,capture_output=True,timeout=230,cwd=ROOT)
            results[name]={'status':'success' if r.returncode==0 else 'failed','details':((r.stderr or '')+' '+(r.stdout or ''))[-600:].strip()}
            if r.returncode==0 and any(word in results[name]['details'] for word in ['Skipped (robots','No approved community feeds','No valid full 50-card decklists','No approved readable feed']):results[name]['status']='skipped'
            print(name,results[name]['status'],results[name]['details'][:250])
        except (subprocess.TimeoutExpired,OSError) as exc:
            results[name]={'status':'failed','details':str(exc)[:600]}
    # Report building failure should fail the job, because it indicates a bad local artifact.
    r=subprocess.run([sys.executable,str(ROOT/'scripts'/'build_reports.py')],cwd=ROOT)
    if r.returncode:raise SystemExit(r.returncode)
    status={}
    try:status=json.loads((DATA/'sync-status.json').read_text('utf-8'))
    except (ValueError,OSError):pass
    status['pipeline']={'lastAttempt':datetime.now(timezone.utc).isoformat(),'sources':results,
        'failedSourceCount':sum(x['status']=='failed' for x in results.values()),'automaticSchedule':'每天 UTC 18:23（台灣 02:23）'}
    atomic_json(DATA/'sync-status.json',status)
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a',encoding='utf-8') as f:
            f.write('## GRAND DECKS 資料同步\n\n')
            for k,v in results.items():f.write(f'- {k}: **{v["status"]}** — {v["details"][:200]}\n')
            f.write('\n失敗來源不會清空既有資料。\n')

if __name__=='__main__':main()
