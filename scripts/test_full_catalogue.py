import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_full_catalogue import from_punk, from_koala, merge_previous, finish_printings, safe_art

class FullCatalogueTests(unittest.TestCase):
    def test_multiple_locales_and_all_print_ids(self):
        tw = {'OP01-001':{'name':'索隆','colors':['Red'],'category':'Leader'},
              'OP01-001_p1':{'name':'索隆異圖','colors':['Red'],'img_full_url':'https://asia-tw.onepiece-cardgame.com/images/cardlist/card/OP01-001_p1.png'}}
        en = {'OP01-001':{'name':'Zoro','colors':['Red'],'category':'Leader'},
              'OP18-001':{'name':'New release','colors':['Blue'],'category':'Leader'},
              'OP01-001_p2':{'name':'Zoro Alt','colors':['Red'],'img_url':'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001_p2.png'}}
        cards, variants = from_punk([('zh-TW',tw),('en',en)])
        self.assertEqual(len(cards),2)
        self.assertEqual(cards['OP01-001']['name'],'索隆')
        self.assertEqual(cards['OP18-001']['name'],'New release')
        self.assertEqual(len(finish_printings(variants,cards)['OP01-001']),4)

    def test_koala_joins_and_deduplicates_by_locale_and_art(self):
        cards, prints = from_punk([('en',{'OP01-001':{'name':'Zoro','colors':['Red']},'OP01-001_p1':{'name':'Zoro','img_url':'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001_p1.png'}})])
        join = [{'key':'card1','number':'OP01-001'}]
        from_koala(join,[('en',[{'key':'prt1','card_key':'card1','variant':'parallel','image_url':'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001_p1.png'}]),('jp',[{'key':'prt2','card_key':'card1','variant':'parallel','image_url':'https://www.onepiece-cardgame.com/images/cardlist/card/OP01-001_p2.png'}])],prints)
        out = finish_printings(prints,cards)
        self.assertEqual(len(out['OP01-001']),3)

    def test_end_to_end_offline_and_stable_snapshots(self):
        import json, tempfile
        from unittest.mock import patch
        import sync_full_catalogue as mod
        rows={f'OP18-{i:03d}':{'name':f'New Card {i}','colors':['Red'],'category':'Character', 'img_full_url':f'https://en.onepiece-cardgame.com/images/cardlist/card/OP18-{i:03d}.png'} for i in range(1,121)}
        def fake_json(url):
            if url.endswith('cards_by_id.json'):
                return rows
            return {'569118':{'id':'569118','raw_title':'OP18 Latest'}}
        def fake_jsonl(url):
            if url.endswith('cards.jsonl'):
                return [{'key':f'c{i}','number':f'OP18-{i:03d}'} for i in range(1,121)]
            return [{'key':f'p{i}', 'card_key':f'c{i}','variant':'base',
                     'image_url':f'https://en.onepiece-cardgame.com/images/cardlist/card/OP18-{i:03d}.png'} for i in range(1,121)]
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); out=root/'cards.json'; pr=root/'printings.json'; status=root/'status.json'
            def fake_status(state,count=0,error=None):
                status.write_text(json.dumps({'cardCatalogue':{'state':state,'cardCount':count}},ensure_ascii=False))
            with patch.object(mod,'OUTPUT',out),patch.object(mod,'PRINTINGS_FILE',pr),patch.object(mod,'STATUS',status),patch.object(mod,'write_status',fake_status),patch.object(mod,'fetch_json',fake_json),patch.object(mod,'fetch_jsonl',fake_jsonl):
                self.assertEqual(mod.run()[0],120)
                self.assertEqual(json.loads(out.read_text())['cardCount'],120)
                self.assertEqual(json.loads(pr.read_text())['byCard']['OP18-001'][0]['printId'],'OP18-001')
                before=out.read_text()
                self.assertEqual(mod.run()[0],120)
                self.assertEqual(before,out.read_text())

    def test_retains_historical_prints_and_blocks_bad_art(self):
        self.assertEqual(safe_art('javascript:alert(1)'),'')
        self.assertEqual(safe_art('https://evil.example.com/images/cardlist/card/OP01-001.png'),'')
        cards, prints = merge_previous([{'id':'OP01-001','name':'Zoro'}], {'OP01-001':[{'cardId':'OP01-001','printId':'OP01-001','locale':'en','kind':'base','image':'','rarity':'','source':'Punk Records'}]}, {}, {})
        self.assertIn('OP01-001',cards)
        self.assertEqual(len(finish_printings(prints,cards)['OP01-001']),1)

if __name__ == '__main__':unittest.main()
