import unittest
from sync_community import entries
class TestFeed(unittest.TestCase):
 def test_rss(self):
  x=b'<rss><channel><item><title>Deck Report</title><link>https://example.com/deck</link><pubDate>Sat, 31 Oct 2026</pubDate></item></channel></rss>'
  self.assertEqual(entries(x)[0]['url'],'https://example.com/deck')
 def test_atom(self):
  x=b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Top eight</title><link href="https://example.com/a"/></entry></feed>'
  self.assertEqual(entries(x)[0]['title'],'Top eight')
 def test_insecure_url(self):
  x=b'<rss><channel><item><title>Bad link</title><link>http://example.com/deck</link></item></channel></rss>'
  self.assertEqual(entries(x),[])
if __name__=='__main__':unittest.main()
