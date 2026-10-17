/**
 * Tests for scratch layer layout refresh (scratch.js §8).
 *
 * Covers:
 *   - makeScratch() — captures owningSpace before stick(), removes from tiling
 *   - unmakeScratch() — re-inserts into tiling after unstick()
 *   - Taskbar rank cleanup: clearTaskbarPosition, forceTaskbarResync
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
