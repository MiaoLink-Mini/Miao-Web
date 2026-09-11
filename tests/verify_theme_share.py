"""Live product-page verification without Gateway requests or CSP bypass."""
import argparse
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True)
parser.add_argument('--browser', required=True)
parser.add_argument('--output', default='tests/results/theme-share')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=args.browser, headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    response = page.goto(args.url, wait_until='networkidle')
    assert response.status == 200
    assert page.locator('#themes').count() == page.locator('#sharing').count() == 1
    for theme in ['ember', 'paper', 'ocean', 'iris', 'forest', 'mono']:
        page.locator('[data-theme-preview=' + theme + ']').click()
        deadline = time.monotonic() + 15
        while not page.locator('#themePreviewImage').evaluate('(i) => i.complete && i.naturalWidth === 780'):
            assert time.monotonic() < deadline, 'Theme image did not load: ' + theme
            page.wait_for_timeout(100)
        assert page.locator('[data-theme-preview][aria-pressed=true]').count() == 1
        assert page.locator('#themePreviewImage').get_attribute('src').endswith('theme-' + theme + '.png')
    page.locator('#themes').screenshot(path=str(output / 'themes-desktop.png'))
    page.locator('[data-open-shot=share]').click()
    assert page.locator('#galleryDialog').evaluate('(dialog) => dialog.open')
    assert page.locator('#galleryImage').get_attribute('src').endswith('assets/shots/share.png')
    page.keyboard.press('Escape')
    widths = [320, 390, 640, 768, 1024, 1440, 1920]
    for width in widths:
        page.set_viewport_size({'width': width, 'height': 900})
        page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('#themes').screenshot(path=str(output / 'themes-mobile.png'))
    page.locator('#sharing').screenshot(path=str(output / 'sharing-mobile.png'))
    assert not errors, errors
    result = {'status': 'pass', 'release': response.headers.get('x-weagent-release'),
              'theme_previews': 6, 'share_modal': True, 'responsive_widths': widths, 'page_errors': errors}
    (output / 'report.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
    browser.close()
