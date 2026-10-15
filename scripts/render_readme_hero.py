#!/usr/bin/env python3
"""Assemble the approved centered README cover from reusable, independently linked pieces.

python3 scripts/render_readme_hero.py [--check]
Only touches hero sections, their SVG assets, and the corresponding translation snapshot.
"""
import argparse
import html
import json
import re
from urllib.parse import urlencode
import translate_readme_incremental as i18n

ROOT = i18n.ROOT
REPO = 'https://github.com/Anionex/banana-slides'
FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
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
            for key, size, height, baseline in [('eyebrow', 11, 24, 17), ('title', 25, 44, 31), ('description', 13, 32, 21)]:
                value = lang['hero'][key]
                width = i18n.hero_text_width(value, size)
                save(key+'-'+lang['asset'], svg(width, height, text(value,width/2,baseline,size,ink if key=='title' else muted,650 if key=='title' else 400),value))
            value = lang['hero']['support']
            width = round(sum(14 if ord(c)>255 else 7.2 for c in value))+6
            save('support-'+lang['asset'], svg(width,26,text(value,width/2,18,14,muted),value))
        for name, label in [('star','Star'),('fork','Fork')]:
            save(name,svg(64,26,text(label,1,18,16,ink,750,'start')+icon(name,'#AD9229',43,4,18),label))
        save('amp',svg(16,26,text('&',8,18,14,muted),'&'))
        save('support-rule',svg(64,26,f'<path d="M8 13H56" fill="none" stroke="{muted}" stroke-opacity="0.35"/>',''))
        save('docker',svg(99,20,icon('docker',muted,0,2,15)+text('Docker Build',21,14,11,muted,400,'start'),'Docker Build'))
        save('deepwiki',svg(112,20,icon('sparkles',muted,0,2,15)+text('Ask DeepWiki',22,14,11,muted,400,'start'),'Ask DeepWiki'))
        save('version',svg(96,20,icon('tag',muted,0,2,15)+text('v0.9.0-rc.7',21,14,11,muted,400,'start'),'v0.9.0-rc.7'))
        for name in ['star','fork','eye','license']:
            save('icon-'+name,svg(18,24,icon(name,muted,1,4,16),''))
    result[ROOT/'assets/readme/space.svg']=svg(900,8,'','')
    return result


def themed(src, alt, width=None, height=None):
    return i18n.theme_picture(src('light'),src('dark'),alt,width,height)


def local(name, alt, width, height):
    return themed(lambda theme:f'./assets/readme/{name}-{theme}.svg',alt,width,height)


def badge(endpoint, label):
    return lambda theme: 'https://img.shields.io/'+endpoint+'?'+urlencode({'style':'flat-square','label':label,'labelColor':'ffffff' if theme=='light' else '0d1117','color':'ffffff' if theme=='light' else '0d1117'})


def template(action_urls):
    metrics=[]
    for name, endpoint, label, destination in [('star','stars','Stars','stargazers'),('fork','forks','Forks','forks'),('eye','watchers','Watchers','watchers')]:
        metrics.append(f'<a href="{REPO}/{destination}">'+local('icon-'+name,'',24,32)+themed(badge('github/'+endpoint+'/Anionex/banana-slides',label),'GitHub '+label,width={'star':91,'fork':96,'eye':109}[name],height=26)+'</a>')
    tech = [f'<a href="{action_urls["desktop"]}">'+local('version','v0.9.0-rc.7',125,26)+'</a>',
            f'<a href="{REPO}/blob/main/LICENSE">'+local('icon-license','',24,32)+themed(badge('github/license/Anionex/banana-slides',''),'AGPL-3.0',width=92,height=26)+'</a>',
            local('docker','Docker Build',129,26),
            '<a href="https://deepwiki.com/Anionex/banana-slides">'+local('deepwiki','Ask DeepWiki',146,26)+'</a>']
    recommendations=(
        '<a href="https://trendshift.io/repositories/22056">'+themed(lambda theme:'./assets/badge-trendshift-dark.svg' if theme=='dark' else 'https://trendshift.io/api/badge/repositories/22056','Anionex%2Fbanana-slides | Trendshift',294,65)+'</a>\n  &nbsp;\n  '+
        '<a href="https://hellogithub.com/repository/Anionex/banana-slides">'+themed(lambda theme:'https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=c8a0ee51918e4353af08012b8472b85e&claim_uid=CtDTm2jbUHhVGBr&theme='+('dark' if theme=='dark' else 'neutral'),'Featured｜HelloGitHub',294,65)+'</a>')
    # UI blocks are owned by the existing language renderer, not a second copy of button markup.
    return ('<div align="center">\n\n'
            '<p>\n  '+themed(lambda theme:f'./assets/hero-{theme}.png','Banana Slides — Vibe your way to great slides.',720,180)+'\n</p>\n\n'
            '<!-- readme:languages -->\n<!-- /readme:languages -->\n\n'
            '<!-- readme:intro -->\n<!-- /readme:intro -->\n\n'
            '<!-- readme:actions -->\n<!-- /readme:actions -->\n\n'
            '<p>\n  '+'\n  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\n  '.join(metrics)+'<br>\n'
            '  '+'\n  &nbsp;&nbsp;&nbsp;&nbsp;\n  '.join(tech)+'\n</p>\n\n'
            '<p>\n  '+recommendations+'\n</p>\n\n'
            '<!-- readme:support -->\n<!-- /readme:support -->\n\n</div>\n\n')


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
        heroes[lang['code']]=preamble+i18n.render_ui(shared,lang,languages,urls)
        outputs[path]=heroes[lang['code']]+'<!-- i18n:sponsors -->'+rest
        assert outputs[path].split('<!-- i18n:sponsors -->',1)[1]==rest
    # All localized hero copy comes from the reviewed language registry; advance only hero snapshots.
    state_path=ROOT/i18n.STATE
    state=json.loads(state_path.read_text())
    canonical=i18n.canonical(i18n.blocks(heroes[config['source']])['hero'])
    for lang in languages:
        if lang['code']==config['source']:continue
        state['languages'][lang['code']]['hero']={'sha256':i18n.digest(canonical),'source':canonical}
    outputs[state_path]=json.dumps(state,ensure_ascii=False,indent=2)+'\n'
    stale=[str(path.relative_to(ROOT)) for path,value in outputs.items() if not path.exists() or path.read_text()!=value]
    if args.check and stale:raise ValueError('Stale hero: '+', '.join(stale))
    if not args.check:i18n.commit_files({path:outputs[path] for path in outputs if str(path.relative_to(ROOT)) in stale})
    print(json.dumps({'status':'ok','mode':'check' if args.check else 'render','changed_files':stale,'editions':len(languages),'svg_assets':len(outputs)-len(languages)-1},ensure_ascii=False))


if __name__=='__main__':main()
