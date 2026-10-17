/**
 * paperwm-mod test runner.
 *
 * Imports every test suite (registering its `describe()` blocks into the
 * shared harness), then runs them all and reports a summary.
 *
 * Test suites that import `gi://` modules (tiling, navigator, scratch, etc.)
 * only resolve inside a GNOME Shell session. In plain `gjs` they are
 * skipped; only `lib.test.js` (pure functions, no `gi://`) runs here.
 *
 * Run (plain gjs, smoke test):   gjs -m tests/run.js
 * Run (inside a shell session):  gjs -m tests/run.js
 * Via make:                      make test
 *
 * Exit code: 0 = all runnable suites passed; 1 = any failure.
 */

import { describe, it, eq, assert, runAndExit, total, passed, failed, skipped } from './harness.js';

const testFiles = [
    './lib.test.js',
    './taskbar.test.js',
    './tiling-span.test.js',
    './tiling-focus.test.js',
    './tiling-taskbar.test.js',
    './tiling-wrap.test.js',
    './scratch.test.js',
    './navigator.test.js',
];

let loaded = 0;
let skippedFiles = [];

function loadNext(i) {
    if (i >= testFiles.length) {
        runAndExit();
        return;
    }
    const file = testFiles[i];
    import(`./${file}`).then(() => {
        loaded++;
        loadNext(i + 1);
    }).catch((e) => {
        skippedFiles.push(file);
        print(`SKIP ${file}: ${e.message}`);
        loadNext(i + 1);
    });
}

loadNext(0);
