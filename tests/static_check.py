"""Check exact local references and source-image hashes; no network needed."""
from pathlib import Path
from bs4 import BeautifulSoup
import hashlib, json, re
ROOT=Path(__file__).resolve().parents[1]
soup=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
ids=[tag['id'] for tag in soup.find_all(id=True)]
assert len(ids)==len(set(ids)), 'Duplicate HTML ids'
references=[]
for tag in soup.find_all(True):
    for key in ['src','href']:
        value=tag.get(key)
        if not value: continue
        if value.startswith('#'):
            assert value[1:] in ids, 'Missing fragment: '+value
        elif '://' not in value and not value.startswith('data:'):
            assert (ROOT/value).is_file(), 'Missing local reference: '+value
            references.append(value)
for source in ['app.js','src/scene.js']:
    text=(ROOT/source).read_text()
    for value in re.findall(r"(?:byId|document\.getElementById)\('([^']+)'\)",text):
        assert value in ids, f'Missing DOM id in {source}: {value}'
manifest=json.loads((ROOT/'docs/asset-manifest.json').read_text())
assert manifest['version']==2 and manifest['native_wechat_verified'] is False
assert manifest['renderer']=='offline-wxml-approximation'
expected=['home','sessions','session','inbox','request','login','me','diff','share'] + ['theme-'+t for t in ['ember','paper','ocean','iris','forest','mono']]
assert [entry['key'] for entry in manifest['screenshots']]==expected
for entry in manifest['screenshots']:
    actual=hashlib.sha256((ROOT/entry['path']).read_bytes()).hexdigest()
    assert actual==entry['sha256'], 'Preview screenshot changed without export: '+entry['path']
    from PIL import Image
    assert Image.open(ROOT/entry['path']).size==(entry['width'],entry['height'])
release=json.loads((ROOT.parent/'release-files.json').read_text())
source_digest=hashlib.sha256()
for name in sorted(n for n in release['files'] if n.startswith('WeAgent-Frontend/miniprogram/')):
    source_digest.update((name+'\0'+hashlib.sha256((ROOT.parent/name).read_bytes()).hexdigest()+'\n').encode())
assert source_digest.hexdigest()==manifest['source_digest'], 'UI source changed; regenerate Web screenshots'
assert hashlib.sha256((ROOT.parent/'WeAgent-Frontend/tools/visual-preview/preview.js').read_bytes()).hexdigest()==manifest['preview_driver_sha256']
print(json.dumps({'status':'pass','unique_ids':len(ids),'local_references':len(references),'current_previews':len(manifest['screenshots']),'source_freshness':'verified'},indent=2))
