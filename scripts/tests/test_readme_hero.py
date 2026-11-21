from pathlib import Path
import sys
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
import render_readme_hero as hero


class TextFallbackTests(unittest.TestCase):
    def test_keeps_native_copy_and_destinations_without_images(self):
        language = {'file': 'README.md', 'name': 'English',
                    'buttons': {'demo': ['Demo', 100], 'desktop': ['Desktop', 100]},
                    'text_fallback': 'Text version'}
        sponsor = ('## Sponsors\n<details open><summary>Collapse</summary>\n'
                   '<p>Use <a href="https://example.com/?a=1&amp;b=2">'
                   '<picture><source srcset="dark.svg"><img src="light.svg" '
                   'alt="Portal &amp; API"></picture></a> for access.</p>\n'
                   '<p><img src="rule.svg" alt=""></p>\n'
                   '<p>Email <a href="mailto:test@example.com"><img '
                   'src="mail.svg" alt="test@example.com"></a>.</p></details>')
        urls = {'demo': 'https://example.com/#demo',
                'desktop': 'https://example.com/#releases'}
        result = hero.text_fallback(language, [language], urls, sponsor)
        for tag in ('<img', '<picture', '<source'):
            self.assertNotIn(tag, result)
        self.assertIn('href="https://example.com/#demo"', result)
        self.assertIn('href="https://example.com/?a=1&amp;b=2">Portal &amp; API</a>', result)
        self.assertIn('href="mailto:test@example.com">test@example.com</a>', result)
        self.assertNotIn('<p></p>', result)
        self.assertEqual(result.count('<details'), 1)
        self.assertNotIn('<details open', result)


class PageThemeTests(unittest.TestCase):
    def test_grouped_images_keep_one_link_per_theme_and_round_trip_destination(self):
        url = hero.REPO+'#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95'
        body = '<a href="'+url+'">'+hero.i18n.theme_picture('icon-light.svg', 'icon-dark.svg', '')+hero.i18n.theme_picture('./assets/buttons/deploy-zh.svg', './assets/buttons/deploy-zh-dark.svg', '部署方法')+'</a>'
        result = hero.i18n.css_themed_images(body)
        self.assertNotIn('<picture>', result)
        self.assertEqual(result.count('<a '), 2)
        self.assertEqual(result.count('<img '), 4)
        self.assertIn('#user-content--%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95#gh-dark-mode-only', result)
        self.assertEqual(hero.i18n.action_destinations(result)['deploy'], url)
        self.assertEqual(hero.i18n.css_themed_images(result), result)

    def test_unsupported_external_fragment_is_unchanged(self):
        body = '<a href="https://example.com/#existing">'+hero.i18n.theme_picture('light.svg', 'dark.svg', 'External')+'</a>'
        self.assertEqual(hero.i18n.css_themed_images(body), body)


if __name__ == '__main__':
    unittest.main()
