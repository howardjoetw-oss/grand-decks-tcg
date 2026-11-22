"""GRAND DECKS free full-series and per-printing metadata sync.

Preserves canonical card IDs for deck legality, and stores distinct printings
in a separate catalogue. All images remain externally hosted by their owners.
Punk Records metadata: https://github.com/buhbbl/punk-records
Koala Kollect data (CC BY 4.0): https://github.com/hotavocado/koala-kollect-data
"""
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from sync_cards import ROOT, OUTPUT, STATUS, base_id, normalise, pack_titles, write_status

PRINTINGS_FILE = ROOT / 'public' / 'data' / 'printings.json'
RAW = 'https://raw.githubusercontent.com/'
PUNK = RAW + 'buhbbl/punk-records/main/'
KOALA = RAW + 'hotavocado/koala-kollect-data/main/data/'
LOCALES = (('chinese-taiwan', 'zh-TW'), ('english', 'en'), ('english-asia', 'en-asia'), ('chinese-hongkong', 'zh-HK'))
KOALA_LOCALES = ('en', 'jp', 'cn', 'tcgcsv')
IMAGE_HOSTS = {'asia-tw.onepiece-cardgame.com', 'asia-tc.onepiece-cardgame.com',
               'en.onepiece-cardgame.com', 'jp.onepiece-cardgame.com',
               'www.onepiece-cardgame.com', 'onepiece-cardgame.com', 'asia-en.onepiece-cardgame.com',
               'tcgplayer-cdn.tcgplayer.com'}
UA = 'GRAND-DECKS/1.0 (free card-metadata index, no image mirroring)'


def fetch_bytes(url, limit=9_000_000):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json,text/plain'})
    with urllib.request.urlopen(req, timeout=16) as response:
        if int(response.headers.get('Content-Length', '0')) > limit:
            raise ValueError('Source exceeds download limit')
        content = response.read(limit + 1)
        if len(content) > limit:
            raise ValueError('Source exceeds download limit')
        return content


def fetch_json(url):
    return json.loads(fetch_bytes(url))


def fetch_jsonl(url):
    return [json.loads(line) for line in fetch_bytes(url).decode('utf-8').splitlines() if line.strip()]


def safe_art(url):
    """Only use existing HTTPS image links from approved upstream hosts."""
    if not isinstance(url, str) or len(url) > 500:
        return ''
    try:
        p = urlsplit(url.strip())
    except ValueError:
        return ''
    if p.scheme != 'https' or p.hostname not in IMAGE_HOSTS or p.username or p.password or p.port not in (None, 443):
        return ''
    if p.hostname == 'tcgplayer-cdn.tcgplayer.com':
        return url.strip() if re.fullmatch(r'/product/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp)', p.path) else ''
    return url.strip() if re.fullmatch(r'/images/cardlist/card/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp)', p.path) else ''


def variant_row(card_id, print_id, locale, kind, rarity, image, source):
    return {'cardId': card_id, 'printId': str(print_id)[:64], 'locale': locale,
            'kind': str(kind or 'unknown')[:35], 'rarity': str(rarity or '')[:40],
            'image': safe_art(image), 'source': source}


def add_variant(table, row):
    if not row.get('cardId') or not row.get('printId'):
        return
    # The same artwork reported by Punk Records and Koala has one entry per language.
    key = (row['locale'], row['image'].split('?')[0] if row['image'] else row['printId'].lower())
    current = table.setdefault(row['cardId'], {})
    old = current.get(key)
    if old is None or (not old['image'] and row['image']):
        current[key] = row


def from_punk(records):
    """records: ordered (locale, index_dict) pairs. Returns deck-safe cards and printings."""
    merged, versions = {}, {}
    for locale, raw in records:
        if not isinstance(raw, dict):
            continue
        for card in normalise(raw):
            if card['id'] not in merged:
                card['language'] = locale
                if locale != 'zh-TW':
                    # Never silently label an English-only result as Taiwanese artwork.
                    exact = raw.get(card['id']) or {}
                    card['image'] = safe_art(exact.get('img_url') or exact.get('img_full_url') or exact.get('image_url'))
                merged[card['id']] = card
            else:
                old = merged[card['id']]
                for field in ('cost', 'power', 'counter'):
                    if old.get(field) is None and card.get(field) is not None:
                        old[field] = card[field]
                if not old.get('colors') and card.get('colors'):
                    old['colors'] = card['colors']
                if not old.get('image'):
                    old['image'] = safe_art((raw.get(card['id']) or {}).get('img_url') or '')
        for pid, row in raw.items():
            cid = base_id(pid)
            if not cid or not isinstance(row, dict):
                continue
            suffix = str(pid)[len(cid):].lower()
            kind = 'base' if not suffix else ('parallel' if suffix.startswith('_p') else 'reprint' if suffix.startswith('_r') else 'other')
            image = row.get('img_url') or row.get('img_full_url') or row.get('image_url') or ''
            add_variant(versions, variant_row(cid, pid, locale, kind, row.get('rarity'), image, 'Punk Records'))
    return merged, versions


def from_koala(cards, printings, versions):
    """Join printing-to-card keys without merging different physical prints."""
    ids = {row.get('key'): base_id(row.get('number')) for row in cards if isinstance(row, dict)}
    for locale, rows in printings:
        for r in rows:
            if not isinstance(r, dict):
                continue
            cid = ids.get(r.get('card_key'))
            if not cid:
                continue
            img = r.get('image_url') or ''
            p = urlsplit(str(img)) if isinstance(img, str) else None
            print_id = p.path.rsplit('/', 1)[-1].split('.')[0] if p and p.path else ''
            print_id = print_id or r.get('key') or ''
            add_variant(versions, variant_row(cid, print_id, locale, r.get('variant'), r.get('rarity'), img, 'Koala Kollect'))


def merge_previous(old_cards, old_printings, cards, prints):
    # Never delete historical cards because a region's index becomes temporarily unavailable.
    for card in old_cards:
        if isinstance(card, dict) and base_id(card.get('id')):
            cards.setdefault(card['id'], card)
    for cid, variants in old_printings.items():
        if not isinstance(variants, list):
            continue
        for row in variants:
            if isinstance(row, dict) and base_id(row.get('cardId')) == cid:
                add_variant(prints, row)
    return cards, prints


def finish_printings(prints, cards):
    out = {}
    for cid, rows in sorted(prints.items()):
        if cid not in cards:
            continue
        out[cid] = sorted(rows.values(), key=lambda p: (
            0 if p['locale'] == 'zh-TW' else 1 if p['locale'] == 'en' else 2,
            0 if p['kind'] == 'base' else 1, p['printId']))
    return out


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(path.suffix + '.tmp')
    part.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    part.replace(path)


def stable_hash(data):
    return hashlib.sha256(json.dumps(data, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()).hexdigest()


def run():
    previous_cards, previous_prints = [], {}
    try:
        previous_cards = json.loads(OUTPUT.read_text('utf-8')).get('cards', [])
    except (OSError, ValueError):
        pass
    try:
        previous_prints = json.loads(PRINTINGS_FILE.read_text('utf-8')).get('byCard', {})
    except (OSError, ValueError):
        pass
    sources, set_titles, errors = [], {}, []
    for region, locale in LOCALES:
        try:
            data = fetch_json(PUNK + region + '/index/cards_by_id.json')
            if not isinstance(data, dict) or len(data) < 100:
                raise ValueError('Empty card index')
            sources.append((locale, data))
            try:
                set_titles.update(pack_titles(fetch_json(PUNK + region + '/packs.json')))
            except Exception as e:
                errors.append(region + ' pack labels: ' + str(e)[:80])
        except Exception as e:
            errors.append(region + ': ' + str(e)[:80])
    if not sources:
        raise ValueError('No usable primary source; preserving old catalogue')
    cards, variants = from_punk(sources)
    # Koala's data adds Japanese and region-specific alternate prints, with CC-BY credit.
    try:
        koala_cards = fetch_jsonl(KOALA + 'cards.jsonl')
        if len(koala_cards) < 100:
            raise ValueError('Unexpectedly small Koala card map')
        # Add IDs released first in Japanese/English, even before a localized name exists.
        for row in koala_cards:
            if not isinstance(row, dict):
                continue
            cid = base_id(row.get('number'))
            if not cid or cid in cards:
                continue
            category = str(row.get('category') or 'Character').title()
            colors = [str(c).title() for c in row.get('colors', [])]
            cards[cid] = {'id':cid, 'name':cid, 'colors':colors, 'category':category,
                          'pack_id':cid.split('-')[0], 'cost':row.get('cost'),
                          'power':row.get('power'), 'counter':row.get('counter'),
                          'rarity':'', 'image':'', 'language':'untranslated'}
        downloads = []
        for locale in KOALA_LOCALES:
            try:
                rows = fetch_jsonl(KOALA + 'printings/' + locale + '.jsonl')
                if len(rows) < 100:
                    raise ValueError('Unexpectedly small printing list')
                downloads.append((locale, rows))
            except Exception as e:
                errors.append('Koala ' + locale + ': ' + str(e)[:80])
        from_koala(koala_cards, downloads, variants)
    except Exception as e:
        errors.append('Koala catalogue: ' + str(e)[:100])
    old_titles = {}
    try:
        old_titles = json.loads(OUTPUT.read_text('utf-8')).get('sets', {})
    except (OSError, ValueError):
        pass
    old_titles.update(set_titles)
    cards, variants = merge_previous(previous_cards, previous_prints, cards, variants)
    if len(cards) < max(100, len(previous_cards)):
        raise ValueError('New dataset unexpectedly smaller than old; preserve both snapshots')
    outputs = finish_printings(variants, cards)
    total = sum(len(v) for v in outputs.values())
    if total < max(100, sum(len(v) for v in previous_prints.values())):
        raise ValueError('Printings unexpectedly shrank; preserving old snapshot')
    card_list = [cards[cid] for cid in sorted(cards)]
    card_digest = stable_hash([card_list, old_titles])
    art_digest = stable_hash(outputs)
    now = datetime.now(timezone.utc).isoformat()
    previous_digest = ''
    try:
        previous_digest = json.loads(OUTPUT.read_text('utf-8')).get('sha256', '')
    except (OSError, ValueError):
        pass
    if previous_digest != card_digest:
        atomic_json(OUTPUT, {'schemaVersion':4, 'source':'Punk Records + Koala Kollect', 'updatedAt':now,
                             'sha256':card_digest, 'cardCount':len(card_list), 'sets':old_titles,
                             'cards':card_list, 'imageNotice':'Links only: art is not mirrored.'})
    old_art_digest = ''
    try:
        old_art_digest = json.loads(PRINTINGS_FILE.read_text('utf-8')).get('sha256', '')
    except (OSError, ValueError):
        pass
    if old_art_digest != art_digest:
        atomic_json(PRINTINGS_FILE, {'schemaVersion':1, 'updatedAt':now, 'sha256':art_digest,
                                     'cardCount':len(outputs), 'printingCount':total,
                                     'attribution':'Koala Kollect (CC BY 4.0): https://github.com/hotavocado/koala-kollect-data; Punk Records: https://github.com/buhbbl/punk-records',
                                     'byCard':outputs})
    write_status('updated' if card_digest != previous_digest else 'unchanged', len(card_list))
    # Retain the original pipeline status fields for older clients.
    status = json.loads(STATUS.read_text('utf-8'))
    status['cardCatalogue']['printingCount'] = total
    status['cardCatalogue']['cardLanguages'] = [locale for locale, _ in sources]
    status['cardCatalogue']['warnings'] = errors[:12]
    atomic_json(STATUS, status)
    print(f'Complete catalogue: {len(card_list)} canonical IDs, {total} distinct regional printings; errors={len(errors)}')
    return len(card_list), total


if __name__ == '__main__':
    try:
        run()
    except Exception as err:
        old_count = 0
        try:
            old_count = json.loads(OUTPUT.read_text('utf-8')).get('cardCount', 0)
        except (OSError, ValueError):
            pass
        write_status('failed', old_count, err)
        raise
