/** Copy the installed, pinned package build into the static website; no bundler required. */
import { readFile, cp, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'node_modules', 'three');
try {
  const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  const project = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (metadata.name !== 'three' || metadata.version !== project.dependencies.three) {
    throw new Error('Installed Three.js does not match the exact pinned dependency. Run npm ci.');
  }
  if (typeof metadata.module !== 'string' || !metadata.module.startsWith('./build/') || metadata.module.includes('..')) {
    throw new Error('Unexpected Three.js ESM entry in package.json; refusing to infer a path.');
  }
  const vendor = path.join(root, 'vendor');
  await mkdir(vendor, { recursive: true });
  await cp(path.join(source, 'build'), path.join(vendor, 'three'), { recursive: true });
  await cp(path.join(source, 'LICENSE'), path.join(vendor, 'THREE-LICENSE.txt'));
  const entry = './three/' + metadata.module.slice('./build/'.length);
  const loader = `/** Local Three.js ${metadata.version}; see THREE-LICENSE.txt. */\nexport * from ${JSON.stringify(entry)};\n`;
  await writeFile(path.join(vendor, 'three-loader.js.tmp'), loader, 'utf8');
  await rename(path.join(vendor, 'three-loader.js.tmp'), path.join(vendor, 'three-loader.js'));
  console.log(`Vendored Three.js ${metadata.version}. The website no longer needs a CDN.`);
} catch (error) {
  console.error('Unable to vendor Three.js:', error.message);
  console.error('Install the locked dependency first: npm ci --ignore-scripts --no-audit --no-fund');
  process.exitCode = 1;
}
