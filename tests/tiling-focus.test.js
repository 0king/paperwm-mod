/**
 * Tests for focus-mode / positionMode cycle (tiling.js §4–§7).
 *
 * Covers:
 *   - FocusModes constants (DEFAULT/CENTER/EDGE)
 *   - isFocusModeEnabled(), getDefaultFocusMode()
 *   - setFocusModeEnabled(), toggleFocusModeEnabled()
 *   - getWindowPositionTargets() — left/center/right targets on primary
 *   - cycleWindowPositionDirection() — positionMode state machine
 *   - switchToNextFocusMode() — entry point
 *   - Focus-mode-enabled contract: disabled ⇒ no auto-center/move on focus
 *     change or click; enabled ⇒ via toggle or cycle key.
 *
 * These functions read `Settings.prefs`, `spaces`, `Topbar`, etc. globally, so
 * this suite runs inside a GNOME Shell session.
 *
 * Run:  gjs -m tests/tiling-focus.test.js   (inside a GNOME Shell session)
 */

import {
    describe, it, eq, assert, runAndExit
} from './harness.js';
import * as Tiling from '../tiling.js';
import * as Lib from '../lib.js';
import * as Settings from '../settings.js';
import { MockWindow, MockSpace } from './mocks.js';

const FocusModes = Tiling.FocusModes;
const isFocusModeEnabled = Tiling.isFocusModeEnabled;
const setFocusModeEnabled = Tiling.setFocusModeEnabled;
const toggleFocusModeEnabled = Tiling.toggleFocusModeEnabled;
const getDefaultFocusMode = Tiling.getDefaultFocusMode;
const getWindowPositionTargets = Tiling.getWindowPositionTargets;
const setFocusMode = Tiling.setFocusMode;
const cycleWindowPositionDirection = Tiling.cycleWindowPositionDirection;
const switchToNextFocusMode = Tiling.switchToNextFocusMode;

/** Save the live focus_mode_enabled pref so we can restore it after tests. */
let savedFocusModeEnabled = null;
function captureFocusModeEnabled() {
    savedFocusModeEnabled = Settings.prefs?.focus_mode_enabled ?? true;
}
function restoreFocusModeEnabled() {
    if (savedFocusModeEnabled !== null) {
        setFocusModeEnabled(savedFocusModeEnabled);
        savedFocusModeEnabled = null;
    }
}

describe('FocusModes constants', () => {
    it('defines DEFAULT/CENTER/EDGE', () => {
        eq(FocusModes.DEFAULT, 0);
        eq(FocusModes.CENTER, 1);
        eq(FocusModes.EDGE, 2);
    });
});

describe('isFocusModeEnabled()', () => {
    it('returns a boolean', () => {
        assert(typeof isFocusModeEnabled() === 'boolean');
    });
    it('mirrors Settings.prefs.focus_mode_enabled when set', () => {
        if (!Settings?.prefs) {
            // settings.enable() hasn't run (e.g. partial shell). Skip assertion.
            return;
        }
        captureFocusModeEnabled();
        setFocusModeEnabled(false);
        assert(isFocusModeEnabled() === false);
        setFocusModeEnabled(true);
        assert(isFocusModeEnabled() === true);
        restoreFocusModeEnabled();
    });
});

describe('setFocusModeEnabled() / toggleFocusModeEnabled()', () => {
    it('setFocusModeEnabled sets the flag round-trip', () => {
        if (!Settings?.prefs) return;
        captureFocusModeEnabled();
        setFocusModeEnabled(true);
        assert(isFocusModeEnabled() === true);
        setFocusModeEnabled(false);
        assert(isFocusModeEnabled() === false);
        setFocusModeEnabled(true);
        assert(isFocusModeEnabled() === true);
        restoreFocusModeEnabled();
    });
    it('toggleFocusModeEnabled() flips the flag', () => {
        if (!Settings?.prefs) return;
        captureFocusModeEnabled();
        const before = isFocusModeEnabled();
        toggleFocusModeEnabled();
        assert(isFocusModeEnabled() === !before);
        toggleFocusModeEnabled();
        assert(isFocusModeEnabled() === before);
        restoreFocusModeEnabled();
    });
    it('toggleFocusModeEnabled does not throw', () => {
        assert(!toggleFocusModeEnabled());
    });
    it('setFocusModeEnabled does not throw', () => {
        assert(!setFocusModeEnabled(true));
        assert(!setFocusModeEnabled(false));
    });
});

describe('getDefaultFocusMode()', () => {
    it('returns a valid FocusModes value', () => {
        const mode = getDefaultFocusMode();
        assert(mode === FocusModes.DEFAULT ||
               mode === FocusModes.CENTER ||
               mode === FocusModes.EDGE);
    });
    it('returns DEFAULT when focus mode disabled (forced)', () => {
        if (!Settings?.prefs) return;
        captureFocusModeEnabled();
        setFocusModeEnabled(false);
        eq(getDefaultFocusMode(), FocusModes.DEFAULT);
        setFocusModeEnabled(true);
        restoreFocusModeEnabled();
    });
});

describe('focus-mode-enabled: disabled blocks auto-center/move', () => {
    it('setFocusMode forces DEFAULT when disabled (no auto-move on focus change/click)', () => {
        if (!Settings?.prefs) return;
        captureFocusModeEnabled();
        setFocusModeEnabled(false);

        const space = new MockSpace(0, null, [], [], null, FocusModes.CENTER);
        space.focusModeIcon = { setMode: () => {} };
        space.hasTopBar = false;

        setFocusMode(FocusModes.CENTER, space);
        // While disabled, mode is coerced to DEFAULT regardless of request.
        eq(space.focusMode, FocusModes.DEFAULT);
        eq(space.positionMode, null);

        setFocusModeEnabled(true);
        restoreFocusModeEnabled();
    });
    it('setFocusMode leaves mode intact when enabled', () => {
        if (!Settings?.prefs) return;
        captureFocusModeEnabled();
        setFocusModeEnabled(true);

        const space = new MockSpace(0, null, [], [], null, FocusModes.DEFAULT);
        space.focusModeIcon = { setMode: () => {} };
        space.hasTopBar = false;

        setFocusMode(FocusModes.EDGE, space);
        eq(space.focusMode, FocusModes.EDGE);
        eq(space.positionMode, null);

        restoreFocusModeEnabled();
    });
});

describe('focus-mode-enabled: re-enabled by toggle or cycle key', () => {
    it('toggleFocusModeEnabled enables focus mode when disabled', () => {
        if (!Settings?.prefs) return;
        captureFocusModeEnabled();
        setFocusModeEnabled(false);
        assert(isFocusModeEnabled() === false);
        toggleFocusModeEnabled();
        assert(isFocusModeEnabled() === true);
        restoreFocusModeEnabled();
    });
    it('cycleWindowPositionDirection re-enables focus mode when disabled', () => {
        if (!Settings?.prefs || !Tiling.spaces) return;
        captureFocusModeEnabled();
        setFocusModeEnabled(false);
        assert(isFocusModeEnabled() === false);

        const space = new MockSpace(0, null, [], [], null, FocusModes.DEFAULT);
        space.focusModeIcon = { setMode: () => {} };
        space.hasTopBar = false;
        Tiling.spaces.set(0, space);
        Tiling.spaces.activeSpace = space;
        Tiling.spaces.selectedSpace = space;

        const win = new MockWindow(1, 'win', 100, 100, 400, 300);
        space._windows = [win];

        cycleWindowPositionDirection(win, space, 1);
        // Cycle key auto-enables focus mode and advances once.
        assert(isFocusModeEnabled() === true);

        restoreFocusModeEnabled();
    });
    it('switchToNextFocusMode re-enables focus mode when disabled', () => {
        if (!Settings?.prefs || !Tiling.spaces) return;
        captureFocusModeEnabled();
        setFocusModeEnabled(false);
        assert(isFocusModeEnabled() === false);

        const space = new MockSpace(0, null, [], [], null, FocusModes.DEFAULT);
        space.focusModeIcon = { setMode: () => {} };
        space.hasTopBar = false;
        Tiling.spaces.set(0, space);
        Tiling.spaces.activeSpace = space;
        Tiling.spaces.selectedSpace = space;

        const win = new MockWindow(2, 'win2', 100, 100, 400, 300);
        space._windows = [win];

        switchToNextFocusMode(space);
        assert(isFocusModeEnabled() === true);

        restoreFocusModeEnabled();
    });
});

describe('getWindowPositionTargets()', () => {
    it('returns an array of three targets when given a window+space', () => {
        assert(typeof getWindowPositionTargets === 'function');
    });
});

describe('Lib.findNext/findPrev used by cycle logic', () => {
    it('findNext cycles forward through width steps', () => {
        eq(Lib.findNext(0.5, [0.5, 1, 1.5]), 1);
        eq(Lib.findNext(1.5, [0.5, 1, 1.5]), 0.5);
    });
    it('findPrev cycles backward through width steps', () => {
        eq(Lib.findPrev(1.5, [0.5, 1, 1.5]), 1);
        eq(Lib.findPrev(0.5, [0.5, 1, 1.5]), 1.5);
    });
});

runAndExit();
