#!/usr/bin/env python3
"""Prepare a small, auditable card *metadata* catalogue for the static PWA.

This importer uses a publicly readable, upstream card-ID index to index factual
card identifiers, names, colours and stats. It does NOT mirror card art or rules
text. Its contents retain third-party rights; publication should be reviewed.
A successful run updates public/data/cards.json. Failed runs preserve old data.
"""
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'data' / 'cards.json'
STATUS = ROOT / 'public' / 'data' / 'sync-status.json'
SOURCE = 'https://raw.githubusercontent.com/buhbbl/punk-records/main/chinese-taiwan/index/cards_by_id.json'
PACKS_SOURCE = 'https://raw.githubusercontent.com/buhbbl/punk-records/main/chinese-taiwan/packs.json'
IMAGE_HOST = 'https://asia-tw.onepiece-cardgame.com/images/cardlist/card/'
UA = 'GrandDecksCardMetadata/0.3 (+noncommercial test client; no images)'
CARD_RE = re.compile(r'^([A-Z0-9]{1,10}-\d{2,4})(?:_[A-Za-z0-9]+)?$')


def base_id(value):
    m = CARD_RE.match(str(value or '').strip().upper())
    return m.group(1) if m else ''


def sane_number(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)) and v >= 0 and v < 10**7:
        return v
    return None


def safe_image(value):
    """Accept only card image URLs from the documented official card-image path.

    Images remain hosted by their owners; no image files are downloaded or mirrored.
    """
    from urllib.parse import urlsplit
    if not isinstance(value, str):
        return ''
    url = value.strip()
    bits = urlsplit(url)
    if bits.scheme != 'https' or bits.netloc not in ('asia-tw.onepiece-cardgame.com', 'asia-tc.onepiece-cardgame.com'):
        return ''
    if not re.match(r'^/images/cardlist/card/[A-Za-z0-9_-]+\.png$', bits.path):
        return ''
    return url


def image_for(bid, row):
    # Prefer a URL actually present in the source index. For older indices,
    # use the regular base-art path documented by the regional card dataset.
    url = safe_image(row.get('img_url') or row.get('img_full_url') or row.get('image_url'))
    return url or (IMAGE_HOST + bid + '.png')


def pack_titles(raw):
    """Official-language public pack labels; index packs are keyed by numeric IDs."""
    items = raw.values() if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
    names = {}
    for pack in items:
        if not isinstance(pack, dict):
            continue
        key = str(pack.get('id') or '').strip()
        title = str(pack.get('raw_title') or (pack.get('title_parts') or {}).get('title') or '').strip()
        if key and title:
            names[key] = title[:140]
    return names


def normalise(raw):
    """Card variants share one canonical ID; image URL is a *remote link*, not a copy."""
    if not isinstance(raw, dict):
        raise ValueError('Expected card ID index object')
    selected = {}
    for alt_id, row in raw.items():
        if not isinstance(row, dict):
            continue
        bid = base_id(alt_id)
        if not bid:
            continue
        name = str(row.get('name') or '').strip()[:150]
        if not name:
            continue
        card = {'id':bid, 'name':name, 'colors':[v for v in row.get('colors', []) if v in ('Red','Green','Blue','Purple','Black','Yellow')][:2],
                'category':str(row.get('category') or 'Character')[:25],
                'pack_id':str(row.get('pack_id') or bid.split('-')[0])[:30],
                'cost':sane_number(row.get('cost')), 'power':sane_number(row.get('power')),
                'counter':sane_number(row.get('counter')), 'rarity':str(row.get('rarity') or '')[:30],
                'image':image_for(bid, row)}
        # Prefer exact ID over an alternate print, and _r1 over alternate variants.
        priority = 2 if str(alt_id).upper() == bid else (1 if str(alt_id).lower().endswith('_r1') else 0)
        prior = selected.get(bid)
        if prior is None or priority > prior[0]:
            selected[bid] = (priority, card)
    return [v[1] for _, v in sorted(selected.items())]


def payload(cards, sets=None):
    sets = sets or {}
    raw = json.dumps({'cards': cards, 'sets': sets}, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    return {'schemaVersion':3, 'source':SOURCE, 'updatedAt':datetime.now(timezone.utc).isoformat(),
            'sha256':hashlib.sha256(raw.encode('utf-8')).hexdigest(), 'cardCount':len(cards), 'sets':sets, 'cards':cards,
            'imageNotice':'Card art is externally served by its rights holders; availability and permission are independent of this metadata index.'}


def run(raw, output=OUTPUT, sets=None):
    cards = normalise(raw)
    if len(cards) < 100:
        raise ValueError(f'Unexpectedly small card catalogue: {len(cards)}; preserving old catalogue')
    data = payload(cards, sets)
    if output.exists():
        try:
            old = json.loads(output.read_text('utf-8'))
            if old.get('sha256') == data['sha256']:
                print(f'Card catalogue unchanged: {len(cards)} canonical IDs')
                return 'unchanged', len(cards)
        except (ValueError, OSError):
            pass
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temp.replace(output)
    print(f'Updated {len(cards)} canonical card IDs')
    return 'updated', len(cards)


def write_status(state, count=0, error=None):
    existing = {}
    if STATUS.exists():
        try:
            existing = json.loads(STATUS.read_text('utf-8'))
        except (OSError, ValueError):
            pass
    existing['cardCatalogue'] = {'checkedAt':datetime.now(timezone.utc).isoformat(),
                                 'state':state, 'cardCount':count,
                                 'source':'Punk Records 繁中索引（TOP DECKS 用於系列核對）',
                                 'message':str(error or '')[:400]}
    STATUS.parent.mkdir(parents=True, exist_ok=True)
    STATUS.write_text(json.dumps(existing,ensure_ascii=False,indent=2), encoding='utf-8')


def read_json(url, limit=7_000_000):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=35) as resp:
        if int(resp.headers.get('Content-Length', '0')) > limit:
            raise ValueError('Index too large')
        return json.loads(resp.read(limit + 1))


def main():
    try:
        index = read_json(SOURCE)
        try:
            sets = pack_titles(read_json(PACKS_SOURCE, limit=1_500_000))
            if len(sets) < 10:
                raise ValueError('Unexpectedly small series catalogue')
        except Exception as err:
            print(f'Series title fetch failed; keeping previous labels: {err}')
            try:
                sets = json.loads(OUTPUT.read_text('utf-8')).get('sets', {})
            except (OSError, ValueError):
                sets = {}
        outcome, count = run(index, sets=sets)
        write_status(outcome, count)
    except Exception as exc:
        # Leave previous snapshot intact; a failed check is not a successful update.
        old_count = 0
        if OUTPUT.exists():
            try:old_count=json.loads(OUTPUT.read_text('utf-8')).get('cardCount',0)
            except (ValueError, OSError):pass
        write_status('failed',old_count,exc)
        raise


if __name__ == '__main__':
    main()
