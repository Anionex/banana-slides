import importlib.util
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    'prepare_nightly_lock', ROOT / 'scripts/prepare_nightly_lock.py'
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrepareNightlyLockTests(unittest.TestCase):
    def test_official_index_preserves_every_locked_version_and_hash(self):
        original = (ROOT / 'uv.lock').read_text()
        prepared = module.prepare_lock(original, 'https://pypi.org/simple')
        self.assertNotIn('https://pypi.tuna.tsinghua.edu.cn/', prepared)
        self.assertIn('https://files.pythonhosted.org/packages/', prepared)
        # Removing URL values leaves precisely the same dependency graph,
        # versions, artifact hashes, sizes, and platform markers.
        strip_urls = lambda value: re.sub(r'https://[^"\s]+', '<url>', value)
        self.assertEqual(strip_urls(original), strip_urls(prepared))
        self.assertEqual(module.prepare_lock(prepared, 'https://pypi.org/simple/'), prepared)

    def test_custom_or_unset_index_is_not_overridden(self):
        original = (ROOT / 'uv.lock').read_text()
        for index in ('', 'https://pypi.tuna.tsinghua.edu.cn/simple', 'https://example.org/simple'):
            with self.subTest(index=index):
                self.assertEqual(module.prepare_lock(original, index), original)


if __name__ == '__main__':
    unittest.main()
