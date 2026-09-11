import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { ResourceScope } from '../src/resource-scope.js';

test('R05: a scope owns unattached resources, deduplicates and disposes in reverse order', () => {
  const calls = [], scope = new ResourceScope();
  const geometry = { dispose() { calls.push('geometry'); } }, material = { dispose() { calls.push('material'); } };
  scope.track(geometry); scope.track(material); scope.track(geometry);
  scope.defer(() => calls.push('observer'));
  assert.deepEqual(scope.dispose(), []); assert.deepEqual(calls, ['observer', 'material', 'geometry']);
  scope.dispose(); assert.equal(calls.length, 3);
});

test('R05: failure of one cleanup cannot prevent renderer/canvas/context cleanup', () => {
  const calls = [], scope = new ResourceScope();
  scope.defer(() => calls.push('canvas')); scope.defer(() => calls.push('context')); scope.defer(() => calls.push('renderer'));
  scope.defer(() => { throw new Error('injected disposer fault'); });
  assert.equal(scope.dispose().length, 1); assert.deepEqual(calls, ['renderer', 'context', 'canvas']);
});

test('R05: early release and late registration cannot leak or double-dispose', () => {
  const scope = new ResourceScope(); let count = 0;
  const resource = { dispose() { count++; } }; scope.track(resource); scope.release(resource); scope.dispose();
  assert.equal(count, 1); scope.track({ dispose() { count++; } }); assert.equal(count, 2);
  scope.defer(() => count++); assert.equal(count, 3);
});

// These are fault-injection control-flow tests, not a WebGL rendering substitute.
for (const failure of ['no-context', 'renderer-constructor', 'scene-constructor', 'clear-color']) {
  test(`R05: unmodified scene initialization releases all allocated resources at ${failure}`, async () => {
    const stats = { allocated: 0, disposed: 0, lost: 0, removed: 0, appended: 0 };
    const stage = { classList: { remove() {} }, dataset: {} };
    const motion = { setAttribute() {}, querySelector() { return {}; } };
    const context = { getExtension() { return { loseContext() { stats.lost++; } }; } };
    const canvas = { getContext() { return failure === 'no-context' ? null : context; }, remove() { stats.removed++; } };
    const dom = { orbitStage: stage, sceneMount: { append() { stats.appended++; } }, sceneStatus: {}, motionToggle: motion };
    const sandbox = vm.createContext({
      document: { getElementById(id) { assert.ok(Object.hasOwn(dom, id)); return dom[id]; }, createElement(name) { assert.equal(name, 'canvas'); return canvas; } },
      window: { matchMedia() { return { matches: false }; }, setTimeout() { return 1; }, clearTimeout() {} },
      console: { warn() {} }, Error
    });
    const library = new vm.SyntheticModule(['WebGLRenderer', 'Scene', 'SRGBColorSpace', 'ACESFilmicToneMapping'], function () {
      this.setExport('WebGLRenderer', class {
        constructor() { if (failure === 'renderer-constructor') throw new Error(failure); stats.allocated++; }
        setClearColor() { if (failure === 'clear-color') throw new Error(failure); }
        setAnimationLoop() {}
        dispose() { stats.disposed++; }
      });
      this.setExport('Scene', class { constructor() { throw new Error('scene-constructor'); } });
      this.setExport('SRGBColorSpace', 'test'); this.setExport('ACESFilmicToneMapping', 0);
    }, { context: sandbox });
    await library.link(() => {}); await library.evaluate();
    const scope = new vm.SourceTextModule(readFileSync(new URL('../src/resource-scope.js', import.meta.url), 'utf8'), { context: sandbox });
    await scope.link(() => {}); await scope.evaluate();
    const source = new vm.SourceTextModule(readFileSync(new URL('../src/scene.js', import.meta.url), 'utf8'), {
      context: sandbox,
      importModuleDynamically(specifier) { assert.equal(specifier, '../vendor/three-loader.js'); return library; }
    });
    await source.link(specifier => { assert.equal(specifier, './resource-scope.js'); return scope; });
    await source.evaluate();
    assert.equal(stage.dataset.renderer, 'fallback'); assert.equal(motion.disabled, true);
    assert.equal(stats.disposed, stats.allocated); assert.equal(stats.removed, 1);
    assert.equal(stats.lost, failure === 'no-context' ? 0 : 1);
    assert.equal(stats.appended, failure === 'scene-constructor' ? 1 : 0);
  });
}
