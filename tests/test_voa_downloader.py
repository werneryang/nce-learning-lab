import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('voa', Path(__file__).parents[1]/'scripts/download-voa.py')
voa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voa)

class CollectorTests(unittest.TestCase):
    def test_extract_separates_body_vocab_credit_and_player(self):
        page = '''<h1>Original title</h1><time datetime="2025-01-01"></time><div class="wsw">
        <div class="wsw__embed"><p>Not article text</p><a href="https://voa-audio.voanews.eu/a.mp3">64 kbps</a></div>
        <p>First <strong>test</strong> paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p>
        <p><em>A writer adapted this for VOA.</em></p><h2>Words in This Story</h2>
        <p>word one – a definition<br />word two – a definition</p></div>'''
        item = voa.extract(page, 'https://learningenglish.voanews.com/a/original/123.html')
        self.assertEqual(len(item['paragraphs']), 3)
        self.assertEqual(item['paragraphs'][0], 'First test paragraph.')
        self.assertEqual(len(item['lesson']['vocabulary']), 2)
        self.assertIn('adapted', item['lesson']['attribution'])
        self.assertEqual(item['lesson']['id'], 'VOA-123')
    def test_link_discovery_ignores_external_and_deduplicates(self):
        self.assertEqual(voa.article_links('<a href="/a/test/123.html"></a><a href="/a/test/123.html"></a><a href="https://other.test/a/123.html"></a>'), ['https://learningenglish.voanews.com/a/test/123.html'])
    def test_unexpected_host_rejected(self):
        for url in ['http://learningenglish.voanews.com/a', 'https://example.com/audio.mp3', 'file:///etc/passwd']:
            with self.assertRaises(ValueError):
                voa.safe_url(url)

if __name__ == '__main__':
    unittest.main()
