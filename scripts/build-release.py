"""Build public-only static output with content-versioned asset URLs.

Requires npm ci first. Output must be a new directory; never overwrites releases.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]


def build(output):
    files = {}
    for name in ['index.html', 'styles.css', 'app.js']:
        files[name] = (ROOT / name).read_bytes()
    for folder in ['src', 'assets']:
        for path in sorted((ROOT / folder).rglob('*')):
            if path.is_symlink():
                raise ValueError('Symlink assets are forbidden')
            if path.is_file():
                if path.suffix.lower() not in ['.js', '.css', '.svg', '.png', '.jpg', '.webp', '.woff2']:
                    raise ValueError('Unreviewed public asset: ' + str(path))
                files[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    package = ROOT / 'node_modules/three'
    version = json.loads((package / 'package.json').read_text())['version']
    assert version == json.loads((ROOT / 'package.json').read_text())['dependencies']['three']
    for path in sorted((package / 'build').glob('*.js')):
        files['vendor/three/' + path.name] = path.read_bytes()
    files['vendor/THREE-LICENSE.txt'] = (package / 'LICENSE').read_bytes()
    files['vendor/three-loader.js'] = b"export * from './three/three.module.js';\n"
    digest = hashlib.sha256()
    for name, data in sorted(files.items()):
        digest.update(name.encode() + b'\0' + hashlib.sha256(data).digest())
    version = digest.hexdigest()[:20]
    prefix = '/_assets/' + version + '/'
    html = files.pop('index.html').decode('utf-8')
    html = re.sub(r'((?:src|href)=")((?:assets/|src/)[^"]+|app\.js|styles\.css)(")',
                  lambda match: match[1] + prefix + match[2] + match[3], html)
    # Runtime image URLs resolve relative to the document, not the JS module.
    files['app.js'] = files['app.js'].decode('utf-8').replace("'assets/", "'" + prefix + 'assets/').encode('utf-8')
    output.mkdir(parents=True, exist_ok=False)
    (output / 'index.html').write_text(html, encoding='utf-8', newline='\n')
    for name, data in files.items():
        path = output / '_assets' / version / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return version


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    print(build(parser.parse_args().output))
