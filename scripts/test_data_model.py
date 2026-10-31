import unittest
from datetime import date
from data_model import canonical_id,validate_deck,consolidate,aggregate

def row(id='a',leader='OP13-004',date_='2026-10-24',cards=None):
    return {'id':id,'source':'Limitless Play','sourceType':'platform_result','sourceUrl':'https://play.limitlesstcg.com/',
       'date':date_, 'event':'Cup 1','country':'TH','player':'Example','placing':1,'wins':5,'losses':0,
       'leaderId':leader,'cards':cards or {'OP17-084_p1':4,'OP17-086':4,'OP17-080':4,'OP17-082':4,'OP17-083':4,
       'OP17-087':4,'OP17-095':4,'OP17-089':4,'OP15-088':4,'OP17-119':4,'OP17-093':4,'OP01-016':4,'ST01-011':2}}
class TestDataModel(unittest.TestCase):
    def test_id(self):self.assertEqual(canonical_id('OP01-001_p1'),'OP01-001')
    def test_full_composition(self):
        a,e=validate_deck(row());self.assertFalse(e);self.assertEqual(a['cardCount'],50);self.assertTrue(a['fingerprint'])
    def test_same_list_fingerprint(self):
        a,_=validate_deck(row('a'));b,_=validate_deck(row('b'));self.assertEqual(a['fingerprint'],b['fingerprint'])
    def test_incomplete(self):
        a,e=validate_deck(row(cards={'OP17-084':4}));self.assertFalse(e);self.assertFalse(a['complete'])
    def test_invalid_id(self):
        a,e=validate_deck(row(cards={'<script>':4}));self.assertTrue(e)
    def test_dedup_result_not_event(self):
        clean,e=consolidate([row('a'),row('a'),row('b')]);self.assertEqual(len(clean),2);self.assertFalse(e)
    def test_meta_not_win_rate(self):
        arr,_=consolidate([row('a'),row('b')]);m=aggregate(arr,30,'ALL',date(2026,10,31))
        self.assertEqual(m['sampleCount'],2);self.assertEqual(m['leaders'][0]['topCutShare'],100.0)
        self.assertIn('不是',m['definition'])
    def test_all_future_excluded(self):
        arr,_=consolidate([row('a',date_='2026-11-25')]);self.assertEqual(aggregate(arr,30,today=date(2026,10,31))['sampleCount'],0)
if __name__=='__main__':unittest.main()
