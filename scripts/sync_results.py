#!/usr/bin/env python3
"""Sync public One Piece Limitless Play tournament results to static JSON.
Safe default: read-only APIs; writes only data/decks.json. No paid services.
The website's social/TopDecks sources are curated, not scraped by this job.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'data' / 'decks.json'
BASE = 'https://play.limitlesstcg.com/api'
UA = 'GrandDecksPublicMetaCollector/0.2 (+noncommercial prototype; GitHub project)'


def iso(v):
    try:
        d = datetime.fromisoformat(str(v).replace('Z', '+00:00'))
        return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return datetime(2000, 1, 1, tzinfo=timezone.utc)


def read_json(url, retries=2):
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                if int(resp.headers.get('Content-Length', '0')) > 15_000_000:
                    raise ValueError('Too large')
                return json.loads(resp.read(15_000_001))
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503) and attempt < retries:
                pause = min(90, int(exc.headers.get('Retry-After', '0')) or 10 * (attempt + 1))
                print(f'HTTP {exc.code}, cooldown {pause}s', file=sys.stderr)
                time.sleep(pause)
                continue
            raise
    raise RuntimeError('Retry failed')


def card_id(card):
    if isinstance(card, str):
        return card.strip().upper()
    if not isinstance(card, dict):
        return ''
    if card.get('id'):
        return str(card['id']).strip().upper()
    if card.get('set') and card.get('number'):
        return f"{card['set']}-{card['number']}".upper()
    return ''


def deck_details(payload):
    if not isinstance(payload, dict):
        return '', '', {}
    leader = payload.get('leader') or {}
    leader_id = card_id(leader)
    leader_name = str(leader.get('name', '')) if isinstance(leader, dict) else ''
    counts = Counter()
    for group, entries in payload.items():
        if group == 'leader' or not isinstance(entries, list):
            continue
        for obj in entries:
            cid = card_id(obj)
            qty = obj.get('count', 1) if isinstance(obj, dict) else 1
            if cid and isinstance(qty, (int, float)) and 0 < qty <= 4:
                counts[cid] += int(qty)
    return leader_id, leader_name, dict(sorted(counts.items()))


def normalize(t, p):
    leader, leader_name, cards = deck_details(p.get('decklist'))
    if not leader:
        return None
    placement = p.get('placing')
    if not isinstance(placement, int) or placement < 1 or placement > 8:
        return None
    record = p.get('record') or {}
    def val(k):
        v = record.get(k)
        return v if isinstance(v, int) and v >= 0 else None
    player_id = str(p.get('player') or p.get('name') or placement)
    tid = str(t['id'])
    return {
        'id': f'limitless:{tid}:{player_id}',
        'source': 'Limitless Play',
        'sourceType': 'platform_result',
        'sourceUrl': f'https://play.limitlesstcg.com/tournament/{urllib.parse.quote(tid, safe="")}/standings',
        'date': str(t['date'])[:10],
        'event': str(t['name'])[:160],
        'players': t.get('players') if isinstance(t.get('players'), int) else None,
        'country': str(p.get('country') or ''),
        'player': str(p.get('name') or player_id)[:100],
        'placing': placement,
        'wins': val('wins'), 'losses': val('losses'), 'ties': val('ties'),
        'leaderId': leader, 'leaderName': leader_name,
        'cards': cards, 'cardCount': sum(cards.values()),
        'evidence': '官方賽事平台排名與選手提交牌組（非現場獨立核實）',
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=45)
    ap.add_argument('--min-players', type=int, default=8)
    ap.add_argument('--max-events', type=int, default=32)
    ap.add_argument('--pages', type=int, default=4)
    args = ap.parse_args()
    old = {'updatedAt': None, 'decks': []}
    if OUTPUT.exists():
        try:
            old = json.loads(OUTPUT.read_text('utf-8'))
        except (ValueError, OSError):
            pass
    cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, args.days))
    events = []
    for page in range(1, max(1, args.pages) + 1):
        url = BASE + '/tournaments?' + urllib.parse.urlencode({'game': 'OP', 'limit': 100, 'page': page})
        rows = read_json(url)
        if not isinstance(rows, list):
            raise ValueError('Unexpected tournaments format')
        if not rows:
            break
        for t in rows:
            if not isinstance(t, dict) or not t.get('id'):
                continue
            if iso(t.get('date')) >= cutoff and (t.get('players') or 0) >= args.min_players:
                events.append(t)
        # Limitless returns newest-first; stop when older than cutoff
        if iso(rows[-1].get('date')) < cutoff:
            break
        time.sleep(1.4)
    events = sorted(events, key=lambda x: x.get('date', ''), reverse=True)[:args.max_events]
    kept = {r['id']: r for r in old.get('decks', []) if isinstance(r, dict) and r.get('id')}
    # Refresh recent events, not the entire archive; old records survive transient failures
    succeeded = 0
    for idx, t in enumerate(events, 1):
        tid = str(t['id'])
        url = f'{BASE}/tournaments/{urllib.parse.quote(tid, safe="")}/standings'
        try:
            standings = read_json(url)
            if not isinstance(standings, list):
                raise ValueError('Unexpected standings format')
            if standings and not any(p.get('decklist') for p in standings if isinstance(p, dict)):
                print(f'{tid}: no public decklists yet; retaining snapshot', file=sys.stderr)
                continue
            fresh = [normalize(t, p) for p in standings if isinstance(p, dict)]
            fresh = [r for r in fresh if r]
            # Delete records only for this tournament after a successful fetch.
            kept = {k: v for k, v in kept.items() if not k.startswith('limitless:' + tid + ':')}
            kept.update((r['id'], r) for r in fresh)
            print(f'{idx}/{len(events)} {tid}: {len(fresh)} top 8 lists')
            succeeded += 1
        except (OSError, ValueError, urllib.error.HTTPError) as exc:
            print(f'{tid}: failure; old data retained: {exc}', file=sys.stderr)
        time.sleep(1.4)
    if not succeeded and not old.get('decks'):
        raise RuntimeError('No successful tournament data. File not overwritten.')
    all_rows = list(kept.values())
    # Keep curated entries; preserve archive up to a sensible cap.
    all_rows.sort(key=lambda x: (str(x.get('date', '')), -(x.get('placing') or 999)), reverse=True)
    all_rows = all_rows[:750]
    previous = old.get('decks') or []
    if previous == all_rows:
        print('No changes; skipping write')
        return
    data = {'schemaVersion': 2, 'updatedAt': datetime.now(timezone.utc).isoformat(), 'decks': all_rows}
    OUTPUT.parent.mkdir(exist_ok=True)
    tmp = OUTPUT.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), 'utf-8')
    tmp.replace(OUTPUT)
    print(f'Wrote {len(all_rows)} sourced decks to {OUTPUT}')

if __name__ == '__main__':
    main()
