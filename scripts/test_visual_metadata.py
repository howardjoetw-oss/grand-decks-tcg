import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_cards import safe_image, image_for, pack_titles, normalise, payload

class VisualMetadataTests(unittest.TestCase):
    def test_pack_names_support_dict_and_list(self):
        packs = {'554117': {'id': '554117', 'raw_title': '補充包 世界最強的戰士【OP-17】'}}
        self.assertEqual(pack_titles(packs)['554117'], '補充包 世界最強的戰士【OP-17】')
        self.assertEqual(pack_titles(list(packs.values()))['554117'], pack_titles(packs)['554117'])

    def test_card_image_is_link_and_no_image_bytes(self):
        cards=normalise({'OP17-001':{'name':'艾德華・紐蓋特','category':'Leader','colors':['Red'], 'img_url':'https://asia-tw.onepiece-cardgame.com/images/cardlist/card/OP17-001.png?261016'}})
        self.assertTrue(cards[0]['image'].startswith('https://asia-tw.onepiece-cardgame.com/'))
        self.assertNotIn('image_data',cards[0])
        self.assertIn('sets',payload(cards,{'554117':'世界最強的戰士'}))

    def test_sanitise_image_url(self):
        self.assertEqual(safe_image('https://example.com/not-an-art.png'),'')
        self.assertEqual(safe_image('javascript:alert(1)'),'')
        self.assertEqual(safe_image('https://asia-tw.onepiece-cardgame.com/images/cardlist/card/OP01-001.png?261016').split('?')[0], 'https://asia-tw.onepiece-cardgame.com/images/cardlist/card/OP01-001.png')
        self.assertTrue(image_for('OP01-001',{}).endswith('/OP01-001.png'))

if __name__ == '__main__':
    unittest.main()
