import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from check_topdecks_sets import parse_series

class SeriesTests(unittest.TestCase):
    def test_series_unique_and_sorted(self):
        html='<html><script>OP99</script><h2>Booster</h2><a>OP18</a><a>OP-17</a><span>EB05</span><b>ST-36</b><b>OP18</b></html>'
        self.assertEqual(parse_series(html),['EB05','OP17','OP18','ST36'])

if __name__=='__main__':unittest.main()
