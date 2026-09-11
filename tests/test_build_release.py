import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_release', ROOT / 'scripts/build-release.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReleaseBuildTests(unittest.TestCase):
    def test_versioned_assets_preserve_navigation_and_refuse_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'site'
            version = module.build(output)
            prefix = '/_assets/' + version + '/'
            html = (output / 'index.html').read_text(encoding='utf-8')
            self.assertIn('href="#themes"', html)
            self.assertIn('href="#sharing"', html)
            self.assertIn('src="' + prefix + 'app.js"', html)
            self.assertIn('href="' + prefix + 'styles.css"', html)
            app = (output / prefix.lstrip('/') / 'app.js').read_text(encoding='utf-8')
            self.assertNotIn("'assets/shots/", app)
            self.assertIn(prefix + 'assets/shots/sessions.png', app)
            self.assertTrue((output / prefix.lstrip('/') / 'vendor/three/three.module.js').is_file())
            self.assertFalse((output / 'package.json').exists())
            self.assertFalse((output / 'scripts').exists())
            with self.assertRaises(FileExistsError):
                module.build(output)
            self.assertEqual((output / 'index.html').read_text(encoding='utf-8'), html)


if __name__ == '__main__':
    unittest.main()
