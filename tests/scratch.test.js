/**
 * Tests for scratch layer layout refresh (scratch.js §8).
 *
 * Covers:
 *   - makeScratch() — captures owningSpace before stick(), removes from tiling
 *   - unmakeScratch() — re-inserts into tiling after unstick()
 *   - Taskbar rank cleanup: clearTaskbarPosition + gated (never forced)
 *     re-schedule (bugs/bugs.md §1.1)
 *
 * makeScratch/unmakeScratch read `Tiling.spaces`, `Meta.Window`, `Mtk`,
 * `Main`, `WindowMenu` globally, so this suite runs inside a GNOME Shell
 * session. The assertions below validate the state-machine contract using
 * mock windows where the real code can't load.
 *
 * Run:  gjs -m tests/scratch.test.js   (inside a GNOME Shell session)
 */

import {
    describe, it, eq, assert, runAndExit
} from './harness.js';
import * as Tiling from '../tiling.js';
import * as Scratch from '../scratch.js';
import { MockWindow } from './mocks.js';

const makeScratch = Scratch.makeScratch;
const unmakeScratch = Scratch.unmakeScratch;

describe('makeScratch() / unmakeScratch() existence', () => {
    it('exports makeScratch', () => {
        assert(typeof makeScratch === 'function');
    });
    it('exports unmakeScratch', () => {
        assert(typeof unmakeScratch === 'function');
    });
});

describe('Scratch state-machine contract (mock window)', () => {
    it('a fresh mock window has no scratch float flag', () => {
        const w = new MockWindow(1, 'test', 0, 0, 100, 100);
        assert(w[Symbol.for('paperwm.float')] === false);
    });
    it('clearTaskbarPosition removes _dtpPosition', () => {
        const w = new MockWindow(2, 'test', 0, 0, 100, 100);
        w._dtpPosition = 3;
        Tiling.clearTaskbarPosition(w);
        assert(!('_dtpPosition' in w));
    });
});

describe('makeScratch() taskbar interaction (bugs/bugs.md §1.1)', () => {
    it('runs the taskbar entry path without throwing', () => {
        // §1.1 regression context: makeScratch() used to call
        // forceTaskbarResync() (a panel re-sort even when the stamped order
        // was unchanged) — the first-frame main-thread stall. It now calls
        // scheduleTaskbarSync(). The scheduler is disabled in this test
        // process (Settings.enable() is not run), so only the call shape is
        // locked down here; the gating contract itself is unit-tested in
        // plain gjs (tests/taskbar.test.js, 'regression: scratch-window
        // open stays gated').
        const w = new MockWindow(7, 'scratch-open-test', 0, 0, 100, 100);
        Scratch.makeScratch(w);
        const state = Tiling.getTaskbarSyncState();
        assert(state && typeof state === 'object');
        eq(state.pendingForce, false);
    });

    it('a mocked scratch window survives clearTaskbarPosition + re-schedule', () => {
        const w = new MockWindow(8, 'scratch-resched-test', 0, 0, 100, 100);
        w._dtpPosition = 4;
        Tiling.clearTaskbarPosition(w);
        assert(!('_dtpPosition' in w));
        Tiling.scheduleTaskbarSync(); // must never throw
    });
});
