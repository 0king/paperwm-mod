/**
 * Regression tests for the clone-animation settle paths in tiling.js.
 *
 * startAnimate() hides every real WindowActor and shows its clone inside
 * `cloneContainer`, which lives in `Main.layoutManager._backgroundGroup` —
 * below every real window, including a desktop-icons DESKTOP window. Only
 * moveDone() restores the real actors. If a completion callback is lost, the
 * tiled content stays visible through the clones while the desktop keeps the
 * input and paints its icons on top (bugs/bugs.md §5).
 *
 * These tests call the real Space.prototype methods with minimal fake spaces,
 * so they only need the `gi://`/shell imports that tiling.js itself pulls in.
 *
 * Run:  gjs -m tests/tiling-animation.test.js   (inside a GNOME Shell session)
 */

import {
    describe, it, eq, assert, runAndExit
} from './harness.js';
import * as Tiling from '../tiling.js';

const { Space } = Tiling;

/**
 * Fake space for moveDone(): only the members moveDone() touches for a space
 * with no windows.
 */
function makeMoveDoneSpace({
    x = 0,
    targetX = 0,
    y = 0,
    xTransition = null,
    yTransition = null,
} = {}) {
    return {
        index: 0,
        targetX,
        actor: {
            y,
            get_transition: name => (name === 'y' ? yTransition : null),
        },
        cloneContainer: {
            x,
            get_transition: name => (name === 'x' ? xTransition : null),
        },
        monitor: { x: 0 },
        selectedWindow: null,
        background: null,
        visible: [],
        _floating: [],
        _isAnimating: true,
        getWindows: () => [],
        fixOverlays() {},
        emit() {},
    };
}

describe('Space.viewportMoveToX settle (bugs/bugs.md §5)', () => {
    function makeViewportSpace(x = 320, targetX = 320) {
        const calls = { animate: 0, done: 0 };
        return {
            calls,
            targetX,
            cloneContainer: {
                x,
                eased: null,
                ease(params) {
                    this.eased = params;
                },
            },
            startAnimate() {
                calls.animate++;
            },
            moveDone() {
                calls.done++;
            },
        };
    }

    it('calls moveDone() for animate=false (was a discarded bind())', () => {
        const space = makeViewportSpace(320, 320);
        Space.prototype.viewportMoveToX.call(space, 0, false);

        eq(space.targetX, 0);
        eq(space.cloneContainer.x, 0);
        eq(space.calls.animate, 1);
        // Regression: `this.moveDone.bind(this);` created a function but never
        // called it, so the clones stayed visible below the desktop.
        eq(space.calls.done, 1);
    });

    it('does not settle synchronously for animate=true', () => {
        const space = makeViewportSpace(320, 320);
        Space.prototype.viewportMoveToX.call(space, 0, true);

        eq(space.calls.animate, 1);
        eq(space.calls.done, 0);
        assert(space.cloneContainer.eased, 'ease() should receive params');
        assert(typeof space.cloneContainer.eased.onComplete === 'function',
            'animated move must settle from onComplete');

        space.cloneContainer.eased.onComplete();
        eq(space.calls.done, 1);
    });
});

describe('Space.moveDone stranded-state recovery (bugs/bugs.md §5)', () => {
    it('snaps a stranded viewport instead of bailing forever', () => {
        const space = makeMoveDoneSpace({ x: 120, targetX: 0 });
        Space.prototype.moveDone.call(space);

        eq(space.cloneContainer.x, 0);
        eq(space._isAnimating, false);
    });

    it('snaps a stranded space y instead of bailing forever', () => {
        const space = makeMoveDoneSpace({ y: 300 });
        Space.prototype.moveDone.call(space);

        eq(space.actor.y, 0);
        eq(space._isAnimating, false);
    });

    it('waits while the viewport transition is still running', () => {
        const space = makeMoveDoneSpace({
            x: 120,
            targetX: 0,
            xTransition: {},
        });
        Space.prototype.moveDone.call(space);

        eq(space.cloneContainer.x, 120);
        eq(space._isAnimating, true);
    });

    it('waits while the space y transition is still running', () => {
        const space = makeMoveDoneSpace({ y: 300, yTransition: {} });
        Space.prototype.moveDone.call(space);

        eq(space.actor.y, 300);
        eq(space._isAnimating, true);
    });
});

describe('Space.layout abort settles clones (bugs/bugs.md §5)', () => {
    it('calls moveDone() when the work area is zero-width', () => {
        let done = 0;
        const space = {
            _populated: true,
            _inLayout: false,
            startAnimate() {},
            moveDone() {
                done++;
            },
            selectedIndex() {
                return -1;
            },
            workArea() {
                return { x: 0, y: 0, width: 0, height: 0 };
            },
        };

        Space.prototype.layout.call(space, false);

        // startAnimate() already hid the actors; the abort must undo it.
        eq(done, 1);
        eq(space._inLayout, false);
    });
});
