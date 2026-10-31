import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from import_topdecks import parse_deck, parse_html
from sync_results import normalize

DECK='1nOP17-039a4nOP08-051a4nOP17-045a4nOP17-052a4nOP17-054a3nOP17-042a2nOP17-044a4nOP17-046a4nOP17-049a4nOP17-040a4nOP17-048a4nOP17-118a4nOP17-055a4nOP17-056a1nEB02-030'

class ImportTests(unittest.TestCase):
 def test_topdecks_50(self):
  leader,cards=parse_deck(DECK);self.assertEqual(leader,'OP17-039');self.assertEqual(sum(cards.values()),50)
 def test_invalid_deck_rejected(self):
  self.assertIsNone(parse_deck('1nOP17-039a4nOP17-040'))
 def test_topdecks_row(self):
  heads=['Deck Composition','Details','Deck Color','Deck Profile','Deck Name','Date','Country','Author','Placement','Tournament','Host']
  vals=[DECK,'','Blue','op17rocks','Blue Rocks','10/24/2026','China','NA','1st Place','4thAnniversary','Bandai(500)']
  html='<table><thead><tr>'+''.join('<th>'+v+'</th>' for v in heads)+'</tr></thead><tbody><tr>'+''.join('<td>'+v+'</td>' for v in vals)+'</tr></tbody></table>'
  rows=parse_html(html,'https://onepiecetopdecks.com/deck-list/japan-op17-deck-list-the-worlds-strongest-warriors/')
  self.assertEqual(len(rows),1);self.assertEqual(rows[0]['cardCount'],50);self.assertEqual(rows[0]['country'],'CN')
 def test_limitless(self):
  t={'id':'abc123','name':'Sample Cup','date':'2026-10-24T00:00:00Z','players':64}
  p={'player':'player1','name':'A','country':'JP','placing':1,'record':{'wins':7,'losses':1},'decklist':{'leader':{'set':'OP17','number':'039','name':'Rocks'},'characters':[{'set':'OP17','number':'040','count':4}]}}
  r=normalize(t,p);self.assertEqual(r['leaderId'],'OP17-039');self.assertEqual(r['wins'],7);self.assertEqual(r['cardCount'],4);self.assertEqual(r['sourceType'],'platform_result')
 def test_no_leader_dropped(self):
  t={'id':'1','name':'Cup','date':'2026-10-24','players':100}
  self.assertIsNone(normalize(t,{'placing':1,'decklist':{}}))

if __name__=='__main__': unittest.main()
