import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from sync_cards import base_id, normalise, run

class CardIndexTests(unittest.TestCase):
    def test_base_and_alt_ids(self):
        self.assertEqual(base_id('OP17-039_p2'),'OP17-039')
        self.assertEqual(base_id('ST01-001'),'ST01-001')
        self.assertEqual(base_id('junk'), '')

    def test_canonical_and_no_art(self):
        rows = {'OP01-001_p1':{'name':'Alternate','colors':['Red'],'category':'Leader','img_full_url':'https://example.com/image.png'},
                'OP01-001':{'name':'索隆','colors':['Red'],'category':'Leader','cost':5},
                'EB01-002_r1':{'name':'甲','colors':['Blue'],'category':'Character'}}
        cards = normalise(rows)
        self.assertEqual(len(cards),2)
        self.assertEqual(cards[1]['name'],'索隆')
        self.assertNotIn('img_full_url',cards[1])
        self.assertNotIn('effect',cards[1])

    def test_failed_smaller_update_preserves_old(self):
        with tempfile.TemporaryDirectory() as td:
            target=Path(td)/'cards.json'
            target.write_text('{"marker":"old"}',encoding='utf-8')
            with self.assertRaises(ValueError):run({'OP01-001':{'name':'A'}}, target)
            self.assertEqual(json.loads(target.read_text())['marker'],'old')

    def test_big_update_and_dedup(self):
        with tempfile.TemporaryDirectory() as td:
            target=Path(td)/'cards.json'
            rows={f'OP01-{i:03d}':{'name':f'卡牌 {i}','colors':['Red'],'category':'Character'} for i in range(1,120)}
            rows['OP01-003_p1']={'name':'異圖','colors':['Red']}
            outcome,n=run(rows,target)
            self.assertEqual((outcome,n),('updated',119))
            self.assertEqual(json.loads(target.read_text())['cardCount'],119)
            outcome2,n2=run(rows,target)
            self.assertEqual((outcome2,n2),('unchanged',119))

if __name__=='__main__':unittest.main()
