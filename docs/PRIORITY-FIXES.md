# Priority fixes, 2026-09-07

This supersedes the validation scope of the initial visual redesign report; `TEST-REPORT.md` is retained as historical evidence.

`src/resource-scope.js` records disposables at allocation time. `scene.js` uses it across initialization, resize/interaction callbacks, frame failures and page disposal. Cleanup stops the render loop, disconnects observers/listeners, disposes geometry/material/texture resources and renderer, releases the context and removes the canvas. Cleanup is idempotent and continues when a disposer throws. Fault-injection tests use failure-only mocks and do not establish real GPU success.

```
npm run check
npm test
python -m unittest discover -s tests -p 'test_*.py' -v
python tests/static_check.py
python tests/verify_ui.py
```

The last command intentionally runs the offline fixture with the real local ResourceScope code but without Three.js. It reports a static fallback, not WebGL.

With a real navigable browser and installed/vendored Three.js:

```
npm ci --ignore-scripts --no-audit --no-fund
npm run vendor
npm start
# Another terminal:
python tests/verify_ui.py --url http://127.0.0.1:8080 --require-three
```

Plain `--url` accepts either valid renderer. `--require-three` forces real Three.js; `--require-fallback` forces fallback and is mutually exclusive. The real path now checks completed render-frame counts, changing canvas pixels, stable paused pixels, resumed frames, offscreen suspension, context loss/restore and teardown. Unsupported context-loss extension is skipped, not counted as a pass. These real-rendering assertions have not been executed successfully in this environment.

New test result: 7 lifecycle/failure tests, 5 verifier-contract tests, 15 offline UI checks; all passed. HTTP resources were verified separately by Python. Chromium policy blocks actual HTTP navigation. Exact evidence and the complete multi-component report are at `../../docs/FIX-REPORT.md` and `../../docs/verification/` in the combined source package.

The page remains a product demonstration, not a live Gateway management client. No new native Agent capabilities are claimed by this patch.
