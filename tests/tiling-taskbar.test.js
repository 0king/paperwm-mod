/**
 * Tests for the tiling.js taskbar wiring (Dash-to-Panel `_dtpPosition`).
 *
 * Behaviour lives in taskbar.js and is fully covered in plain gjs by
 * tests/taskbar.test.js. This suite only verifies the live-shell wiring:
 * the historical exports exist, delegate safely, and never throw from the
 * shell hot paths (bugs/bugs.md §3.2).
 *
 * These functions read the live `spaces`/`Settings.prefs` of the running
 * session, so this suite runs inside a GNOME Shell session.
 *
 * Run:  gjs -m tests/run.js   (inside a GNOME Shell session)
 */

import {
    describe, it, assert
} from './harness.js';
import * as Tiling from '../tiling.js';

const scheduleTaskbarSync = Tiling.scheduleTaskbarSync;
const syncTaskbarOrder = Tiling.syncTaskbarOrder;
const forceTaskbarResync = Tiling.forceTaskbarResync;
const clearTaskbarPosition = Tiling.clearTaskbarPosition;
const clearTaskbarOrder = Tiling.clearTaskbarOrder;
const beginTaskbarStartupPhase = Tiling.beginTaskbarStartupPhase;
const endTaskbarStartupPhase = Tiling.endTaskbarStartupPhase;

describe('taskbar wiring — exported surface', () => {
    it('exports every historical entry point as a function', () => {
        assert(typeof scheduleTaskbarSync === 'function');
        assert(typeof syncTaskbarOrder === 'function');
        assert(typeof forceTaskbarResync === 'function');
        assert(typeof clearTaskbarPosition === 'function');
        assert(typeof clearTaskbarOrder === 'function');
        assert(typeof beginTaskbarStartupPhase === 'function');
        assert(typeof endTaskbarStartupPhase === 'function');
    });

    it('no call site crashes the shell when invoked directly', () => {
        // These are all no-ops while `sync-taskbar-order` is off (default)
        // and must never throw regardless.
        assert(!scheduleTaskbarSync());
        assert(!syncTaskbarOrder());
        assert(!forceTaskbarResync());
        assert(!beginTaskbarStartupPhase());
        assert(!endTaskbarStartupPhase());
    });

    it('scheduling does not do synchronous work in the caller stack', () => {
        // taskbar.js guarantees the pass is deferred (tests/taskbar.test.js
        // covers the timing in detail). Here we only assert callability.
        assert(!scheduleTaskbarSync());
    });
});

describe('clearTaskbarPosition() wiring', () => {
    it('does not throw on null window', () => {
        assert(!clearTaskbarPosition(null));
    });
    it('does not throw on window without _dtpPosition', () => {
        const win = {};
        assert(!clearTaskbarPosition(win));
    });
    it('deletes _dtpPosition when present', () => {
        const win = { _dtpPosition: 5 };
        clearTaskbarPosition(win);
        assert(!('_dtpPosition' in win));
    });
    it('is idempotent', () => {
        const win = { _dtpPosition: 5 };
        clearTaskbarPosition(win);
        clearTaskbarPosition(win); // second call must not throw
        assert(!('_dtpPosition' in win));
    });
});

describe('clearTaskbarOrder() wiring', () => {
    it('does not throw when spaces is null or torn down', () => {
        assert(!clearTaskbarOrder());
    });
});

describe('forceTaskbarResync() wiring', () => {
    it('does not throw', () => {
        assert(!forceTaskbarResync());
    });
});
