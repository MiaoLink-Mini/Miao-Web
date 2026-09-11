#!/usr/bin/env python3
"""Export current mini-program UI to the product gallery.

Uses actual reviewed WXML/WXSS and the repository's isolated fixture renderer.
This is not a WeChat compiler or a real session screenshot. No external requests.
Run from the complete repository after installing Playwright and Chromium.
"""
from pathlib import Path
import argparse, base64, hashlib, json, re, shutil, subprocess, tempfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'WeAgent-Web'
SHOTS = [
    ('home', 'home', 'ember'), ('sessions', 'sessions', 'ember'),
    ('session', 'session', 'ember'), ('inbox', 'inbox', 'ember'),
    ('request', 'request', 'ember'), ('login', 'login', 'ember'),
    ('me', 'me', 'ember'), ('diff', 'panel', 'ember'), ('share', 'share', 'ember'),
    *[('theme-' + theme, 'session', theme) for theme in ['ember','paper','ocean','iris','forest','mono']],
]

def source_digest():
    manifest = json.loads((ROOT / 'release-files.json').read_text())
    digest = hashlib.sha256()
    for name in sorted(n for n in manifest['files'] if n.startswith('WeAgent-Frontend/miniprogram/')):
        digest.update((name + '\0' + hashlib.sha256((ROOT / name).read_bytes()).hexdigest() + '\n').encode())
    return digest.hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', default=shutil.which('chromium') or shutil.which('google-chrome'))
    args = parser.parse_args()
    if not args.chromium:
        parser.error('Supply --chromium with an installed browser executable.')
    with tempfile.TemporaryDirectory(prefix='weagent-shots-') as directory:
        temporary = Path(directory)
        html_path = temporary / 'current.html'
        subprocess.run(['node', str(ROOT / 'WeAgent-Frontend/tools/visual-preview/build.cjs'), str(html_path)], check=True)
        html = html_path.read_text()
        prefix = 'window.PREVIEW_DATA='
        payload = json.JSONDecoder().raw_decode(html.split(prefix, 1)[1])[0]
        # The fixture must embed the CURRENT files; do not take old HTML as evidence.
        for name, text in payload['source'].items():
            if (ROOT / 'WeAgent-Frontend/miniprogram' / name).read_bytes().decode('utf-8') != text:
                raise ValueError('Outdated source embedded in preview: ' + name)
        source_before = source_digest()
        result = {'version': 2, 'renderer': 'offline-wxml-approximation', 'native_wechat_verified': False,
                  'data': 'isolated-fictional-fixtures', 'source_digest': source_before,
                  'preview_driver_sha256': hashlib.sha256((ROOT / 'WeAgent-Frontend/tools/visual-preview/preview.js').read_bytes()).hexdigest(),
                  'viewport': {'width': 390, 'height': 844, 'device_scale_factor': 2}, 'screenshots': []}
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=args.chromium, args=['--no-sandbox', '--disable-dev-shm-usage'])
            context = browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,reduced_motion='reduce')
            context.route(re.compile(r'^https?://'), lambda route: route.abort())
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            for key, route, theme in SHOTS:
                query = '?page=' + route + '&theme=' + theme
                boot = '<script>window.__PREVIEW_QUERY=' + json.dumps(query) + ';Date.now=()=>1788739200000;</script>'
                page.set_content(html.replace('<head>', '<head>' + boot, 1), wait_until='load')
                page.wait_for_function('window.__preview && window.__preview.ready')
                page.evaluate('window.__preview.setMotion("off")')
                if key == 'diff':
                    page.locator('.diff-tools button').nth(1).click()
                    page.wait_for_selector('.code-diff.wrapped')
                page.evaluate('document.fonts.ready')
                page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
                page.wait_for_timeout(50)
                if errors or page.evaluate('window.__preview.expressionErrors.length'):
                    raise ValueError('Preview render failed: ' + repr(errors or page.evaluate('window.__preview.expressionErrors')))
                if page.evaluate('document.body.scrollWidth') > 390:
                    raise ValueError('Horizontal overflow: ' + route)
                filename = temporary / (key + '.png')
                page.screenshot(path=str(filename), animations='disabled')
                result['screenshots'].append({'key':key,'page':route,'theme':theme,
                    'path':'assets/shots/' + key + '.png','width':780,'height':1688,
                    'view_state': {'diff_wrap': True} if key == 'diff' else {},
                    'sha256':hashlib.sha256(filename.read_bytes()).hexdigest()})
            result['browser'] = browser.version
            context.close(); browser.close()
        if source_digest() != source_before:
            raise ValueError('Mini-program source changed while taking screenshots; rerun export.')
        # Publish only after all renders succeed.
        (WEB / 'assets/shots').mkdir(parents=True, exist_ok=True)
        for entry in result['screenshots']:
            shutil.copyfile(temporary / (entry['key'] + '.png'), WEB / entry['path'])
        (WEB / 'docs/asset-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        print('Exported', len(result['screenshots']), 'source UI previews; NOT native WeChat captures.')

if __name__ == '__main__':
    main()
