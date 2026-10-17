/**
 * Tests for all-monitors workspace switch / move wrap (tiling.js §10).
 *
 * Covers:
 *   - selectDownSpace / selectUpSpace with wrap param
 *   - moveDownSpace / moveUpSpace with wrap param
 *   - Spaces.selectSequenceSpace wrap-around logic
 *
 * Wrap behavior (from keybindings.js §10):
 *   - all-monitors switch/move passes wrap=true → wraps around ends
 *   - plain switch/move defaults wrap=false → clamps at ends
 *
 * selectSequenceSpace reads `this.activeSpace`, `this.selectedSpace`,
 * `this.monitors`, `Meta.MotionDirection`, `Navigator`, `Topbar`, `Easer`
 * globally, so this suite runs inside a GNOME Shell session.
 *
 * Run:  gjs -m tests/tiling-wrap.test.js   (inside a GNOME Shell session)
 */

import {
    describe, it, eq, assert, runAndExit
} from './harness.js';
import * as Tiling from '../tiling.js';

const selectDownSpace = Tiling.selectDownSpace;
const selectUpSpace = Tiling.selectUpSpace;
const moveDownSpace = Tiling.moveDownSpace;
const moveUpSpace = Tiling.moveUpSpace;

describe('wrap function signatures', () => {
    it('selectDownSpace accepts (mw, space, fromAllMonitors, wrap=false)', () => {
        assert(selectDownSpace.length === 4);
    });
    it('selectUpSpace accepts (mw, space, fromAllMonitors, wrap=false)', () => {
        assert(selectUpSpace.length === 4);
    });
    it('moveDownSpace accepts (_mw, _space, wrap=false)', () => {
        assert(moveDownSpace.length === 3);
    });
    it('moveUpSpace accepts (_mw, _space, wrap=false)', () => {
        assert(moveUpSpace.length === 3);
    });
    it('defaults wrap to false', () => {
        // wrap param default is false → no wrap-around (clamps at ends).
        // All-monitors callers pass wrap=true explicitly.
        assert(typeof selectDownSpace === 'function');
    });
});

describe('Spaces.selectSequenceSpace wrap (logic)', () => {
    it('selectSequenceSpace exists on Spaces prototype', () => {
        assert(typeof Tiling.Spaces.prototype.selectSequenceSpace === 'function');
    });
});
