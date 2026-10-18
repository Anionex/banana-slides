#!/usr/bin/env python3
"""Assemble the approved centered README cover from reusable, independently linked pieces.

python3 scripts/render_readme_hero.py [--check]
Updates hero sections, the text fallback footer, SVG assets and translation snapshots.
"""
import argparse
import html
import json
import re
import translate_readme_incremental as i18n

ROOT = i18n.ROOT
REPO = 'https://github.com/Anionex/banana-slides'
FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
METRICS = [
    ('star', 'Stars', 'stargazers', 'stargazers_count', 91),
    ('fork', 'Forks', 'forks', 'forks_count', 96),
    ('eye', 'Watchers', 'watchers', 'subscribers_count', 109),
]
# Exact icon nodes exported from the installed lucide-react package; see its retained ISC license.
ICON_SOURCE = json.loads((ROOT / 'assets/readme/lucide-icons.json').read_text())
ICONS = {name: item['body'] for name, item in ICON_SOURCE['icons'].items()}


def icon(name, color, x=0, y=0, size=16):
    return (f'<g transform="translate({x} {y}) scale({size/24})" fill="none" stroke="{color}" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</g>')


def svg(width, height, content, label=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-label="{html.escape(label, quote=True)}">\n'
            f'<title>{html.escape(label)}</title>\n{content}\n</svg>\n')


def text(value, x, y, size, color, weight=400, anchor='middle'):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" fill="{color}" font-family="{FONT}" '
            f'font-size="{size}" font-weight="{weight}">{html.escape(value)}</text>')


def assets(languages):
    result = {}
    for theme, ink, muted in [('light', '#24262B', '#777B83'), ('dark', '#EEEDE7', '#969B95')]:
        def save(name, value):
            result[ROOT / f'assets/readme/{name}-{theme}.svg'] = value
        for lang in languages:
            value = lang['hero']['support']
            width = round(sum(14 if ord(c)>255 else 7.2 for c in value))+6
            save('support-'+lang['asset'], svg(width,26,text(value,width/2,18,14,muted),value))
        for name, label in [('star','Star'),('fork','Fork')]:
            save(name,svg(64,26,text(label,1,18,16,ink,750,'start')+icon(name,'#AD9229',43,4,18),label))
        save('amp',svg(16,26,text('&',8,18,14,muted),'&'))
        save('support-rule',svg(64,26,f'<path d="M8 13H56" fill="none" stroke="{muted}" stroke-opacity="0.35"/>',''))
        save('section-rule',svg(620,20,f'<path d="M0 10H620" fill="none" stroke="{muted}" stroke-opacity="0.22"/>',''))
        save('docker',svg(99,20,icon('docker',muted,0,2,15)+text('Docker Build',21,14,11,muted,400,'start'),'Docker Build'))
        save('deepwiki',svg(112,20,icon('sparkles',muted,0,2,15)+text('Ask DeepWiki',22,14,11,muted,400,'start'),'Ask DeepWiki'))
        save('version',svg(96,20,icon('tag',muted,0,2,15)+text('v0.9.0-rc.7',21,14,11,muted,400,'start'),'v0.9.0-rc.7'))
        save('license',svg(78,22,text('AGPL-3.0',39,16,13,ink),'AGPL-3.0'))
        for name in ['star','fork','eye','license']:
            save('icon-'+name,svg(18,24,icon(name,muted,1,4,16),''))
    result[ROOT/'assets/readme/space.svg']=svg(900,8,'','')
    return result


def themed(src, alt, width=None, height=None):
    return i18n.theme_picture(src('light'),src('dark'),alt,width,height)


def local(name, alt, width, height):
    return themed(lambda theme:f'./assets/readme/{name}-{theme}.svg',alt,width,height)


def template(action_urls):
    metrics=[]
    for name, label, destination, _, width in METRICS:
        metrics.append(f'<a href="{REPO}/{destination}">'+local('icon-'+name,'',24,32)+local('metric-'+name,'GitHub '+label,width,26)+'</a>')
    tech = [f'<a href="{action_urls["desktop"]}">'+local('version','v0.9.0-rc.7',106,22)+'</a>',
            f'<a href="{REPO}/blob/main/LICENSE">'+local('icon-license','',20,27)+local('license','AGPL-3.0',78,22)+'</a>',
            local('docker','Docker Build',109,22),
            '<a href="https://deepwiki.com/Anionex/banana-slides">'+local('deepwiki','Ask DeepWiki',123,22)+'</a>']
    recommendations=(
        '<a href="https://trendshift.io/repositories/22056">'+themed(lambda theme:'./assets/badge-trendshift-dark.svg' if theme=='dark' else 'https://trendshift.io/api/badge/repositories/22056','Anionex%2Fbanana-slides | Trendshift',244,54)+'</a>\n  &nbsp;\n  '+
        '<a href="https://hellogithub.com/repository/Anionex/banana-slides">'+themed(lambda theme:'https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=c8a0ee51918e4353af08012b8472b85e&claim_uid=CtDTm2jbUHhVGBr&theme='+('dark' if theme=='dark' else 'neutral'),'Featured｜HelloGitHub',244,54)+'</a>')
    # UI blocks are owned by the existing language renderer, not a second copy of button markup.
    return ('<div align="center">\n\n'
            '<a name="readme-top"></a>\n\n'
            '<div>\n  '+themed(lambda theme:f'./assets/hero-{theme}.png','Banana Slides — Vibe your way to great slides.',720,180)+'\n</div>\n\n'
            '<!-- readme:intro -->\n<!-- /readme:intro -->\n\n'
            '<!-- readme:languages -->\n<!-- /readme:languages -->\n\n'
            '<!-- readme:actions -->\n<!-- /readme:actions -->\n\n'
            '<div>\n  '+local('section-rule','',620,20)+'\n</div>\n\n'
            '<p>\n  '+'\n  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\n  '.join(metrics)+'\n</p>\n\n'
            '<p>\n  '+recommendations+'\n</p>\n\n'
            '<p>\n  '+'\n  &nbsp;\n  '.join(tech)+'\n</p>\n\n'
            '<!-- readme:support -->\n<!-- /readme:support -->\n\n'
            '<div><img src="./assets/readme/space.svg" alt="" width="1" height="32"></div>\n\n</div>\n\n')


def text_fallback(language, languages, action_urls, sponsor):
    """Keep essential destinations usable without any image requests or scripts."""
    def link(url, label):
        return f'<a href="{html.escape(url, quote=True)}">{html.escape(label)}</a>'

    language_links = ' · '.join(link(lang['file'], lang['name']) for lang in languages)
    actions = ' · '.join(link(action_urls[name], data[0])
                         for name, data in language['buttons'].items())
    community = ' · '.join(link(url, label) for label, _, url
                           in language.get('community', {}).values())
    if community:
        actions += ' · ' + community
    project_links = ' · '.join(link(url, label) for url, label in [
        (REPO+'/stargazers', 'Stars'), (REPO+'/forks', 'Forks'),
        (REPO+'/watchers', 'Watchers'), (action_urls['desktop'], 'v0.9.0-rc.7'),
        (REPO+'/blob/main/LICENSE', 'AGPL-3.0'),
        ('https://deepwiki.com/Anionex/banana-slides', 'Ask DeepWiki'),
        ('https://trendshift.io/repositories/22056', 'Trendshift'),
        ('https://hellogithub.com/repository/Anionex/banana-slides', 'HelloGitHub'),
    ])
    # Derive sponsor copy and links from the same localized section, so a
    # fallback never introduces independently edited or stale promotional copy.
    sponsor = re.sub(r'^## .*\n', '', sponsor, count=1, flags=re.M)
    sponsor = re.sub(r'<summary>.*?</summary>|</?details[^>]*>', '', sponsor, flags=re.S)
    def image_text(match):
        alt = re.search(r'\balt="([^"]*)"', match[0])
        return alt[1] if alt else ''
    sponsor = re.sub(r'<picture>.*?</picture>|<img\b[^>]*>', image_text, sponsor, flags=re.S)
    sponsor = re.sub(r'<p>\s*</p>', '', sponsor)
    sponsor = re.sub(r'(?<![\w">:])davidyang042@gmail\.com',
                     '<a href="mailto:davidyang042@gmail.com">davidyang042@gmail.com</a>', sponsor)
    sponsor = re.sub(r'^> (.*)$', r'<blockquote><p>\1</p></blockquote>', sponsor, flags=re.M)
    assert not re.search(r'<(?:img|picture|source)\b', sponsor)
    return ('<details align="left">\n<summary>'+html.escape(language['text_fallback'])
            +'</summary>\n\n<p><strong>Banana Slides</strong></p>\n\n<p>'
            +language_links+'</p>\n\n<p>'+actions+'</p>\n\n<p>'+project_links
            +'</p>\n\n'+sponsor.strip()+'\n\n</details>')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    config=i18n.load_config(ROOT)
    languages=config['languages']
    source=(ROOT/'README.md').read_text()
    action_block=next(m[0] for m in i18n.MANAGED.finditer(source) if m[1]=='actions')
    urls=i18n.action_destinations(action_block)
    if set(urls)!={'demo','docs','desktop','deploy'}:raise ValueError('Expected all four existing destinations')
    shared=template(urls)
    outputs=assets(languages)
    heroes={}
    for lang in languages:
        path=ROOT/lang['file']
        before=path.read_text()
        if '<!-- i18n:sponsors -->' not in before:raise ValueError('Missing sponsors boundary')
        hero,rest=before.split('<!-- i18n:sponsors -->',1)
        preamble=hero[:hero.index('<div align="center">')]
        sponsor = i18n.blocks(before)['sponsors']
        rendered = i18n.render_ui(shared,lang,languages,urls)
        heroes[lang['code']]=preamble+rendered
        rest = rest.split('<!-- i18n:text-fallback -->', 1)[0]
        outputs[path]=(heroes[lang['code']]+'<!-- i18n:sponsors -->'+rest
                       +'<!-- i18n:text-fallback -->\n'
                       +text_fallback(lang,languages,urls,sponsor)+'\n')
    # Only advance snapshots for the generated sections.
    state_path=ROOT/i18n.STATE
    state=json.loads(state_path.read_text())
    source_blocks=i18n.blocks(outputs[ROOT/next(lang['file'] for lang in languages if lang['code']==config['source'])])
    for section in ('hero', 'text-fallback'):
        canonical=i18n.canonical(source_blocks[section])
        for lang in languages:
            if lang['code']==config['source']:continue
            state['languages'][lang['code']][section]={'sha256':i18n.digest(canonical),'source':canonical}
    outputs[state_path]=json.dumps(state,ensure_ascii=False,indent=2)+'\n'
    stale=[str(path.relative_to(ROOT)) for path,value in outputs.items() if not path.exists() or path.read_text()!=value]
    if args.check and stale:raise ValueError('Stale hero: '+', '.join(stale))
    if not args.check:i18n.commit_files({path:outputs[path] for path in outputs if str(path.relative_to(ROOT)) in stale})
    print(json.dumps({'status':'ok','mode':'check' if args.check else 'render','changed_files':stale,'editions':len(languages),'svg_assets':len(outputs)-len(languages)-1},ensure_ascii=False))


if __name__=='__main__':main()
