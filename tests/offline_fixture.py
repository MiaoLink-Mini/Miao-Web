"""Render local files in-memory without changing browser navigation policies.
Only dependency loading is intentionally failed, to verify the documented fallback.
Static source assets and scripts are inlined; the delivered files are not modified.
"""
from pathlib import Path
import base64, mimetypes, re
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]

def build_fixture():
    soup=BeautifulSoup((ROOT/'index.html').read_text(), 'html.parser')
    for tag in soup.find_all('script'): tag.decompose()
    for tag in soup.find_all('link'): tag.decompose()
    style=soup.new_tag('style');style.string=(ROOT/'styles.css').read_text();soup.head.append(style)
    assets={}
    for path in (ROOT/'assets').rglob('*'):
        if path.is_file():
            key=path.relative_to(ROOT).as_posix()
            mime=mimetypes.guess_type(path)[0] or 'application/octet-stream'
            assets[key]=f'data:{mime};base64,'+base64.b64encode(path.read_bytes()).decode()
    for img in soup.find_all('img'):
        if img.get('src') in assets: img['src']=assets[img['src']]
    app=(ROOT/'app.js').read_text()
    for path,data in assets.items():
        app=app.replace("'"+path+"'", "'"+data+"'")
    scene=(ROOT/'src/scene.js').read_text().replace("'../vendor/three-loader.js'", "'data:text/javascript,throw new Error(%22Offline verification intentionally omits Three.js%22)'")
    scope=base64.b64encode((ROOT/'src/resource-scope.js').read_bytes()).decode()
    scene=scene.replace("'./resource-scope.js'", "'data:text/javascript;base64,"+scope+"'")
    return str(soup),app,scene

def load_fixture(page, fixture, javascript=True):
    html,app,scene=fixture
    page.set_content(html, wait_until='load')
    if javascript:
        page.add_script_tag(content=app)
        page.add_script_tag(content=scene,type='module')
        page.wait_for_function("document.querySelector('#orbitStage').dataset.renderer === 'fallback'")
