/**
 * Tests for taskbar.js — Dash-to-Panel order sync scheduler.
 *
 * Regression coverage for bugs/bugs.md §3.2 (autostart windows missing /
 * misordered on Dash-to-Panel at login):
 *
 *   - no taskbar work ever runs synchronously from `schedule()`
 *   - debounce coalesces the login window burst; passes run in an idle
 *     callback, never in the caller's stack
 *   - ordering: spaces by workspace index, tiled before floating, globally
 *     unique contiguous `_dtpPosition` ranks
 *   - signature gate: nudges only on real order changes
 *   - nudge targeting: Dash-to-Panel's own deferred redisplay, never the
 *     global `AppFavorites 'changed'` broadcast (bugs/bugs.md §1.1)
 *   - scratch-window opens stay gated: no nudge when the order is unchanged
 *     (bugs/bugs.md §1.1)
 *   - forceResync bypasses the gate (and is still deferred)
 *   - startup phase: bounded forced re-assert chains, so a panel that
 *     enabled late / painted an early snapshot is corrected — the actual
 *     failure mode of §3.2
 *   - clearPosition/clearOrder cancel queued passes and never throw
 *   - robustness: throwing settings/spaces/windows/timers/accessors
 *
 * taskbar.js has no `gi://` imports, so this suite runs in plain `gjs`
 * without a GNOME Shell session.
 *
 * Run:  make test   (suite is imported by tests/run.js)
 */

import {
    describe, it, eq, assert
} from './harness.js';
import { createTaskbarSync, createDashToPanelNudge, TaskbarSyncDefaults } from '../taskbar.js';

// ---------------------------------------------------------------------------
// Fake clock: deterministic stand-in for GLib timeouts + Meta idle callbacks.
// ---------------------------------------------------------------------------

class FakeClock {
    constructor() {
        this.now = 0;
        this.nextId = 1;
        this.timers = new Map(); // id -> { fn, at }
        this.idles = new Map();  // id -> fn
        this.firedTimers = 0;
    }

    setTimeout(fn, ms) {
        const id = this.nextId++;
        this.timers.set(id, { fn, at: this.now + Math.max(0, Number(ms) || 0) });
        return id;
    }

    clearTimeout(id) {
        this.timers.delete(id);
    }

    scheduleIdle(fn) {
        const id = this.nextId++;
        this.idles.set(id, fn);
        return id;
    }

    /** Earliest timer due at or before both `maxAt` and `nowAt`. */
    _earliest(maxAt, nowAt) {
        let best = null;
        for (const [id, t] of this.timers) {
            if (t.at <= maxAt && t.at <= nowAt) {
                if (best === null || t.at < best.t.at) {
                    best = { id, t };
                }
            }
        }
        return best;
    }

    _fire(id) {
        const t = this.timers.get(id);
        if (!t) {
            return;
        }
        this.timers.delete(id);
        this.now = Math.max(this.now, t.at);
        this.firedTimers++;
        t.fn();
    }

    /** Run due timers only (no idle flush) up to `ms` from now. */
    step(ms) {
        const end = this.now + Math.max(0, Number(ms) || 0);
        for (let guard = 0; guard < 10000; guard++) {
            let nextId = null;
            let nextAt = Infinity;
            for (const [id, t] of this.timers) {
                if (t.at <= end && t.at < nextAt) {
                    nextAt = t.at;
                    nextId = id;
                }
            }
            if (nextId === null) {
                break;
            }
            this._fire(nextId);
        }
        this.now = end;
    }

    /** Run one pending idle callback. */
    _flushIdleOnce() {
        const entry = this.idles.entries().next().value;
        if (!entry) {
            return false;
        }
        this.idles.delete(entry[0]);
        entry[1]();
        return true;
    }

    /** Run all pending idle callbacks (they may schedule more). */
    flushIdle() {
        for (let guard = 0; this.idles.size && guard < 10000; guard++) {
            this._flushIdleOnce();
        }
    }

    /**
     * Advance like the shell main loop would: timers fire when due, pending
     * idles run whenever nothing is ready.
     */
    advance(ms) {
        const end = this.now + Math.max(0, Number(ms) || 0);
        for (let guard = 0; guard < 20000; guard++) {
            const dueNow = this._earliest(this.now, this.now);
            if (dueNow) {
                this._fire(dueNow.id);
                continue;
            }
            if (this._flushIdleOnce()) {
                continue;
            }
            const next = this._earliest(end, Infinity);
            if (next) {
                this._fire(next.id);
                continue;
            }
            break;
        }
        this.now = end;
    }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Test controller with every platform hook captured for assertions. */
function makeSync(options = {}) {
    const clock = new FakeClock();
    const env = {
        enabled: options.enabled ?? true,
        settingsThrow: false,
        spacesThrow: false,
        nudgeThrows: false,
        spaces: options.spaces ?? null,
        allWindows: options.allWindows ?? [],
        nudges: 0,
        nudgeTimes: [],
        errors: [],
    };
    const sync = createTaskbarSync({
        config: options.config,
        isEnabled: () => {
            if (env.settingsThrow) {
                throw new Error('settings access failed');
            }
            return env.enabled;
        },
        getSpaces: () => {
            if (env.spacesThrow) {
                throw new Error('spaces access failed');
            }
            return env.spaces;
        },
        setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
        clearTimeout: id => clock.clearTimeout(id),
        scheduleIdle: fn => clock.scheduleIdle(fn),
        emitNudge: () => {
            env.nudges++;
            env.nudgeTimes.push(clock.now);
            options.onNudge?.(clock, env);
            if (env.nudgeThrows) {
                throw new Error('nudge failed');
            }
        },
        getAllWindows: () => env.allWindows,
        logError: (...args) => env.errors.push(args.map(String).join(' ')),
    });
    return { sync, clock, env };
}

function makeWindow(id) {
    return {
        get_stable_sequence: () => id,
        get_id: () => id,
    };
}

/** Window whose stable-sequence accessor throws (dead window). */
function makeThrowingWindow(id) {
    return {
        get_stable_sequence: () => { throw new Error('dead window'); },
        get_id: () => id,
    };
}

function makeSpace(index, windows = [], floating = []) {
    return {
        workspace: { index: () => index },
        getWindows: () => windows,
        _floating: floating,
    };
}

function makeSpaces(...spaces) {
    const map = new Map();
    for (const s of spaces) {
        map.set(s.workspace.index(), s);
    }
    return map;
}

function ranks(windows) {
    return windows.map(w => w._dtpPosition);
}

const FAST = { debounceMs: 5, startupResyncDelaysMs: [10, 20, 40], startupPhaseMs: 0 };

// ---------------------------------------------------------------------------
// Setting gate / no-op paths
// ---------------------------------------------------------------------------

describe('taskbar sync — setting gate', () => {
    it('schedule() is a no-op when the setting is off', () => {
        const w = makeWindow(1);
        const h = makeSync({ enabled: false, spaces: makeSpaces(makeSpace(0, [w])) });
        assert(h.sync.schedule() === false);
        eq(h.clock.timers.size, 0);
        h.clock.advance(500);
        eq(w._dtpPosition, undefined);
        eq(h.env.nudges, 0);
    });

    it('forceResync() is a no-op when the setting is off', () => {
        const h = makeSync({ enabled: false });
        assert(h.sync.forceResync() === false);
        eq(h.clock.timers.size, 0);
    });

    it('syncNow() is a no-op when the setting is off', () => {
        const w = makeWindow(1);
        const h = makeSync({ enabled: false, spaces: makeSpaces(makeSpace(0, [w])) });
        assert(h.sync.syncNow() === false);
        eq(w._dtpPosition, undefined);
    });

    it('treats a throwing settings accessor as disabled (never throws)', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.env.settingsThrow = true;
        assert(h.sync.schedule() === false);
        assert(h.sync.syncNow() === false);
        h.clock.advance(200);
        eq(w._dtpPosition, undefined);
    });

    it('works after the setting is turned on later', () => {
        const w = makeWindow(1);
        const h = makeSync({ enabled: false, spaces: makeSpaces(makeSpace(0, [w])) });
        h.env.enabled = true;
        assert(h.sync.schedule() === true);
        h.clock.advance(50);
        eq(w._dtpPosition, 0);
        eq(h.env.nudges, 1);
    });

    it('turning the setting off while a pass is queued cancels the stamping', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.schedule();
        h.env.enabled = false;
        h.clock.advance(200);
        eq(w._dtpPosition, undefined);
        eq(h.env.nudges, 0);
    });

    it('logs (instead of throwing) when no timer backend is configured', () => {
        const w = makeWindow(1);
        const errors = [];
        const nudges = [];
        const sync = createTaskbarSync({
            isEnabled: () => true,
            getSpaces: () => makeSpaces(makeSpace(0, [w])),
            emitNudge: () => nudges.push(1),
            logError: (...args) => errors.push(args.map(String).join(' ')),
        });
        assert(sync.schedule() === false);
        assert(sync.forceResync() === false);
        assert(errors.length >= 1);
        // syncNow() needs no timer and still works.
        assert(sync.syncNow() === true);
        eq(w._dtpPosition, 0);
        eq(nudges.length, 1);
    });
});

// ---------------------------------------------------------------------------
// Debounce + deferral (the "no sync work on main thread" contract)
// ---------------------------------------------------------------------------

describe('taskbar sync — debounce and deferral', () => {
    it('does no work synchronously from schedule()', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.schedule();
        eq(w._dtpPosition, undefined);
        eq(h.env.nudges, 0);
        eq(h.clock.idles.size, 0);
    });

    it('runs the pass in an idle callback, not in the timer callback', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.schedule();
        h.clock.step(TaskbarSyncDefaults.debounceMs);
        eq(h.clock.firedTimers, 1);
        // Debounce fired but the pass has not run yet.
        eq(w._dtpPosition, undefined);
        eq(h.env.nudges, 0);
        eq(h.clock.idles.size, 1);
        h.clock.flushIdle();
        eq(w._dtpPosition, 0);
        eq(h.env.nudges, 1);
    });

    it('waits at least debounceMs before firing', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.schedule();
        h.clock.step(49);
        eq(w._dtpPosition, undefined);
        h.clock.step(1);
        h.clock.flushIdle();
        eq(w._dtpPosition, 0);
    });

    it('coalesces a burst of schedules into one pass', () => {
        const a = makeWindow(1);
        const b = makeWindow(2);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [a, b])) });
        h.sync.schedule();
        h.clock.step(20);
        h.sync.schedule();
        h.clock.step(20);
        h.sync.schedule();
        eq(h.clock.timers.size, 1); // one armed debounce, not three
        h.clock.step(50);           // 50ms since the last schedule
        h.clock.flushIdle();
        eq(h.clock.firedTimers, 1);
        eq(ranks([a, b]), [0, 1]);
        eq(h.env.nudges, 1);
    });

    it('re-schedules a fresh debounce window on every schedule()', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.schedule();
        h.clock.step(40);
        h.sync.schedule();
        h.clock.step(40); // only 40ms since the second schedule
        eq(w._dtpPosition, undefined);
        h.clock.step(10);
        h.clock.flushIdle();
        eq(w._dtpPosition, 0);
    });

    it('a pass queued while another idle is pending is gated by the signature', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.schedule();
        h.clock.step(50);     // debounce fired, idle pending
        h.sync.schedule();    // arms another debounce
        h.clock.advance(200); // both passes run
        eq(w._dtpPosition, 0);
        eq(h.env.nudges, 1);  // same order → single nudge
    });

    it('never throws when a timer backend throws', () => {
        const errors = [];
        const sync = createTaskbarSync({
            isEnabled: () => true,
            getSpaces: () => new Map(),
            setTimeout: () => { throw new Error('no sources'); },
            clearTimeout: () => {},
            scheduleIdle: () => {},
            emitNudge: () => {},
            logError: (...args) => errors.push(args.map(String).join(' ')),
        });
        assert(sync.schedule() === false);
        assert(errors.length >= 1);
    });
});

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

describe('taskbar sync — order stamping', () => {
    it('stamps tiled windows left-to-right from zero', () => {
        const a = makeWindow(1);
        const b = makeWindow(2);
        const c = makeWindow(3);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [a, b, c])) });
        h.sync.syncNow();
        eq(ranks([a, b, c]), [0, 1, 2]);
    });

    it('orders spaces by workspace index, not insertion order', () => {
        const a = makeWindow(11);
        const b = makeWindow(22);
        const c = makeWindow(33);
        const s0 = makeSpace(0, [a]);
        const s1 = makeSpace(1, [b]);
        const s2 = makeSpace(2, [c]);
        const h = makeSync({ spaces: makeSpaces(s2, s0, s1) });
        h.sync.syncNow();
        eq(ranks([a, b, c]), [0, 1, 2]);
    });

    it('appends floating windows after tiled windows within a space', () => {
        const t0 = makeWindow(1);
        const f0 = makeWindow(2);
        const t1 = makeWindow(3);
        const f1 = makeWindow(4);
        const h = makeSync({
            spaces: makeSpaces(
                makeSpace(0, [t0], [f0]),
                makeSpace(1, [t1], [f1])
            ),
        });
        h.sync.syncNow();
        eq(ranks([t0, f0, t1, f1]), [0, 1, 2, 3]);
    });

    it('produces globally unique contiguous ranks', () => {
        const windows = [1, 2, 3, 4, 5].map(id => makeWindow(id));
        const h = makeSync({
            spaces: makeSpaces(
                makeSpace(1, windows.slice(0, 2), [windows[2]]),
                makeSpace(0, windows.slice(3))
            ),
        });
        h.sync.syncNow();
        const all = ranks(windows).sort((x, y) => x - y);
        eq(all, [0, 1, 2, 3, 4]);
        eq(new Set(all).size, all.length);
    });

    it('skips null/undefined window entries', () => {
        const a = makeWindow(1);
        const c = makeWindow(3);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [a, null, undefined, c])) });
        h.sync.syncNow();
        eq(ranks([a, c]), [0, 1]);
    });

    it('stamps windows whose stable sequence throws and keeps a usable signature', () => {
        const a = makeWindow(1);
        const bad = makeThrowingWindow(2);
        const c = makeWindow(3);
        const windows = [a, bad, c];
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, windows)) });
        h.sync.syncNow();
        eq(ranks([a, bad, c]), [0, 1, 2]);
        eq(h.env.nudges, 1);
        // Membership change is still detected despite the throwing accessor.
        windows.splice(1, 1);
        h.sync.syncNow();
        eq(h.env.nudges, 2);
    });

    it('still stamps other spaces when one space accessor throws', () => {
        const a = makeWindow(1);
        const b = makeWindow(2);
        const badSpace = {
            workspace: { index: () => 0 },
            getWindows: () => { throw new Error('dead space'); },
            _floating: [],
        };
        const h = makeSync({ spaces: makeSpaces(badSpace, makeSpace(1, [a, b])) });
        h.sync.syncNow();
        eq(ranks([a, b]), [0, 1]);
        eq(h.env.nudges, 1);
    });

    it('treats non-finite workspace indices as zero', () => {
        const a = makeWindow(1);
        const b = makeWindow(2);
        const badSpace = makeSpace(0, [a]);
        badSpace.workspace = { index: () => NaN };
        const h = makeSync({ spaces: makeSpaces(badSpace, makeSpace(1, [b])) });
        h.sync.syncNow();
        eq(ranks([a, b]).filter(p => typeof p === 'number').length, 2);
    });

    it('is a no-op (no throw) when spaces is null', () => {
        const h = makeSync({ spaces: null });
        assert(h.sync.syncNow() === false);
        eq(h.env.nudges, 0);
    });

    it('logs and returns when the spaces accessor throws', () => {
        const h = makeSync();
        h.env.spacesThrow = true;
        assert(h.sync.syncNow() === false);
        assert(h.env.errors.length >= 1);
    });
});

// ---------------------------------------------------------------------------
// Signature gate + forced resync
// ---------------------------------------------------------------------------

describe('taskbar sync — signature gate', () => {
    it('does not nudge again when the order is unchanged (but re-stamps)', () => {
        const a = makeWindow(1);
        const b = makeWindow(2);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [a, b])) });
        h.sync.syncNow();
        eq(h.env.nudges, 1);
        // Simulate a stale/overwritten override.
        a._dtpPosition = 99;
        h.sync.syncNow();
        eq(a._dtpPosition, 0);   // re-stamped
        eq(h.env.nudges, 1);     // not nudged
    });

    it('nudges when a window is added', () => {
        const a = makeWindow(1);
        const windows = [a];
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, windows)) });
        h.sync.syncNow();
        windows.push(makeWindow(2));
        h.sync.syncNow();
        eq(h.env.nudges, 2);
    });

    it('nudges when a window is removed', () => {
        const a = makeWindow(1);
        const b = makeWindow(2);
        const windows = [a, b];
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, windows)) });
        h.sync.syncNow();
        windows.splice(1, 1);
        h.sync.syncNow();
        eq(h.env.nudges, 2);
    });

    it('nudges when the order changes', () => {
        const a = makeWindow(1);
        const b = makeWindow(2);
        const windows = [a, b];
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, windows)) });
        h.sync.syncNow();
        windows.reverse();
        h.sync.syncNow();
        eq(ranks([b, a]), [0, 1]);
        eq(h.env.nudges, 2);
    });

    it('records the signature even when the nudge emit throws', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.env.nudgeThrows = true;
        h.sync.syncNow();
        eq(h.env.errors.length, 1);
        h.sync.syncNow(); // same order: gate suppresses a repeat attempt
        eq(h.env.errors.length, 1);
    });
});

describe('taskbar sync — forceResync', () => {
    it('nudges even when the order is unchanged', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.syncNow();
        eq(h.env.nudges, 1);
        h.sync.forceResync();
        h.clock.advance(100);
        eq(h.env.nudges, 2);
        eq(w._dtpPosition, 0);
    });

    it('is deferred: nothing happens until debounce + idle', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.forceResync();
        eq(h.env.nudges, 0);
        eq(w._dtpPosition, undefined);
        h.clock.step(TaskbarSyncDefaults.debounceMs);
        eq(h.env.nudges, 0); // idle not flushed yet
        h.clock.flushIdle();
        eq(h.env.nudges, 1);
    });

    it('resets the signature so the next pass nudges again', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.syncNow();
        h.sync.forceResync();
        h.clock.advance(100);
        eq(h.env.nudges, 2);
        h.sync.syncNow(); // same order as the forced pass
        eq(h.env.nudges, 2);
    });
});

// ---------------------------------------------------------------------------
// clearPosition / clearOrder
// ---------------------------------------------------------------------------

describe('taskbar sync — clearPosition', () => {
    it('does not throw on null', () => {
        const h = makeSync();
        assert(!h.sync.clearPosition(null));
    });

    it('does not throw on a window without a rank', () => {
        const h = makeSync();
        assert(!h.sync.clearPosition({}));
    });

    it('deletes the rank', () => {
        const h = makeSync();
        const w = { _dtpPosition: 5 };
        h.sync.clearPosition(w);
        assert(!('_dtpPosition' in w));
    });

    it('is idempotent', () => {
        const h = makeSync();
        const w = { _dtpPosition: 5 };
        h.sync.clearPosition(w);
        h.sync.clearPosition(w);
        assert(!('_dtpPosition' in w));
    });

    it('never throws on a throwing host object', () => {
        const h = makeSync();
        const w = {};
        Object.defineProperty(w, '_dtpPosition', {
            get: () => { throw new Error('hostile'); },
            configurable: true,
        });
        h.sync.clearPosition(w);
    });
});

describe('taskbar sync — clearOrder', () => {
    it('removes ranks from tiled and floating windows in every space', () => {
        const t = makeWindow(1);
        const f = makeWindow(2);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [t], [f])) });
        h.sync.syncNow();
        eq(ranks([t, f]), [0, 1]);
        h.sync.clearOrder();
        assert(!('_dtpPosition' in t));
        assert(!('_dtpPosition' in f));
    });

    it('sweeps windows that never joined a Space', () => {
        const stray = { _dtpPosition: 7 };
        const h = makeSync({ enabled: false, allWindows: [stray] });
        h.sync.clearOrder();
        assert(!('_dtpPosition' in stray));
    });

    it('cancels a queued pass so overrides cannot be re-stamped', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.schedule();
        h.sync.clearOrder();
        h.clock.advance(500);
        assert(!('_dtpPosition' in w));
        eq(h.env.nudges, 0);
    });

    it('is idempotent and safe with no spaces', () => {
        const h = makeSync({ spaces: null });
        h.sync.clearOrder();
        h.sync.clearOrder();
    });

    it('still sweeps when the space accessor throws', () => {
        const stray = { _dtpPosition: 7 };
        const h = makeSync({ allWindows: [stray] });
        h.env.spacesThrow = true;
        h.sync.clearOrder();
        assert(!('_dtpPosition' in stray));
    });

    it('still sweeps when one space accessor throws', () => {
        const a = makeWindow(1);
        const stray = { _dtpPosition: 7 };
        const badSpace = {
            workspace: { index: () => 0 },
            getWindows: () => { throw new Error('dead space'); },
            _floating: [],
        };
        const h = makeSync({ spaces: makeSpaces(badSpace, makeSpace(1, [a])), allWindows: [stray] });
        h.sync.syncNow();
        h.sync.clearOrder();
        assert(!('_dtpPosition' in a));
        assert(!('_dtpPosition' in stray));
    });

    it('resets the signature gate', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.syncNow();
        eq(h.env.nudges, 1);
        h.sync.clearOrder();
        h.sync.syncNow();
        eq(h.env.nudges, 2);
    });

    it('works while the setting is off', () => {
        const w = { _dtpPosition: 3 };
        const h = makeSync({ enabled: false, allWindows: [w] });
        h.sync.clearOrder();
        assert(!('_dtpPosition' in w));
    });
});

// ---------------------------------------------------------------------------
// Startup phase (the §3.2 fix): bounded forced re-assert chains
// ---------------------------------------------------------------------------

describe('taskbar sync — startup phase', () => {
    it('beginStartupPhase() alone does not nudge', () => {
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [makeWindow(1)])), config: FAST });
        h.sync.beginStartupPhase();
        eq(h.env.nudges, 0);
        eq(h.sync.getState().startupPhase, true);
    });

    it('a pass during the phase arms the forced chain', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])), config: FAST });
        h.sync.beginStartupPhase();
        h.sync.schedule();
        h.clock.advance(FAST.debounceMs);
        eq(h.env.nudges, 1);
        eq(h.sync.getState().startupChainActive, true);
        eq(h.sync.getState().startupChainsStarted, 1);
    });

    it('the chain force-re-asserts exactly startupResyncDelaysMs.length times', () => {
        const w = makeWindow(1);
        const h = makeSync({
            spaces: makeSpaces(makeSpace(0, [w])),
            config: { ...FAST, startupPhaseMs: 0 },
        });
        h.sync.beginStartupPhase();
        h.sync.schedule();
        h.clock.advance(5);              // initial pass → nudge #1
        eq(h.env.nudges, 1);
        h.clock.advance(1000);           // chain: 3 forced passes
        eq(h.env.nudges, 1 + FAST.startupResyncDelaysMs.length);
        eq(h.sync.getState().startupChainActive, false);
        // Bounded: no further nudges without new activity.
        const settled = h.env.nudges;
        h.clock.advance(1000);
        eq(h.env.nudges, settled);
    });

    it('a new pass after a completed chain starts a fresh (bounded) chain', () => {
        const w = makeWindow(1);
        const h = makeSync({
            spaces: makeSpaces(makeSpace(0, [w])),
            config: { ...FAST, startupPhaseMs: 0 },
        });
        h.sync.beginStartupPhase();
        h.sync.schedule();
        h.clock.advance(1000);
        const first = h.env.nudges;
        eq(first, 1 + FAST.startupResyncDelaysMs.length);
        h.sync.forceResync();            // simulate late activity
        h.clock.advance(1000);
        // The forced pass itself plus one pass per chain step.
        eq(h.env.nudges, first + 1 + FAST.startupResyncDelaysMs.length);
        eq(h.sync.getState().startupChainsStarted, 2);
    });

    it('the phase auto-ends after startupPhaseMs and makes a final forced pass', () => {
        const w = makeWindow(1);
        const h = makeSync({
            spaces: makeSpaces(makeSpace(0, [w])),
            config: { debounceMs: 5, startupResyncDelaysMs: [10], startupPhaseMs: 50 },
        });
        h.sync.beginStartupPhase();
        h.sync.schedule();
        h.clock.advance(5);
        eq(h.env.nudges, 1);
        h.clock.advance(60); // phase timer at 50 → final force → nudge
        eq(h.sync.getState().startupPhase, false);
        assert(h.env.nudges >= 2);
        const settled = h.env.nudges;
        h.clock.advance(1000);
        eq(h.env.nudges, settled);
    });

    it('endStartupPhase() cancels the chain and performs a final re-assert', () => {
        const w = makeWindow(1);
        const h = makeSync({
            spaces: makeSpaces(makeSpace(0, [w])),
            config: { ...FAST, startupPhaseMs: 0 },
        });
        h.sync.beginStartupPhase();
        h.sync.schedule();
        h.clock.advance(6); // initial pass only, chain step not fired yet
        eq(h.env.nudges, 1);
        h.sync.endStartupPhase();
        eq(h.sync.getState().startupPhase, false);
        h.clock.advance(100);
        eq(h.env.nudges, 2); // only the final forced pass, chain cancelled
        const settled = h.env.nudges;
        h.clock.advance(1000);
        eq(h.env.nudges, settled);
    });

    it('does not arm chains outside the startup phase', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])), config: FAST });
        h.sync.schedule();
        h.clock.advance(1000);
        eq(h.env.nudges, 1);
        eq(h.sync.getState().startupChainsStarted, 0);
    });

    it('stops the chain when the setting is turned off mid-flight', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])), config: FAST });
        h.sync.beginStartupPhase();
        h.sync.schedule();
        h.clock.advance(6);
        eq(h.env.nudges, 1);
        h.env.enabled = false;
        h.clock.advance(1000);
        eq(h.env.nudges, 1);
        eq(h.sync.getState().startupChainActive, false);
    });

    it('dispose() cancels the startup chain', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])), config: FAST });
        h.sync.beginStartupPhase();
        h.sync.schedule();
        h.clock.advance(6);
        const before = h.env.nudges;
        h.sync.dispose();
        h.clock.advance(1000);
        eq(h.env.nudges, before);
        eq(h.sync.getState().disposed, true);
    });

    it('beginStartupPhase() is a no-op once disposed', () => {
        const h = makeSync({ config: FAST });
        h.sync.dispose();
        h.sync.beginStartupPhase();
        eq(h.sync.getState().startupPhase, false);
    });
});

// ---------------------------------------------------------------------------
// Robustness / lifecycle
// ---------------------------------------------------------------------------

describe('taskbar sync — robustness', () => {
    it('dispose() is idempotent and stops all scheduled work', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])) });
        h.sync.schedule();
        h.sync.dispose();
        h.sync.dispose();
        h.clock.advance(500);
        eq(w._dtpPosition, undefined);
        eq(h.env.nudges, 0);
    });

    it('all entry points are safe after dispose', () => {
        const w = { _dtpPosition: 4 };
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [makeWindow(1)])) });
        h.sync.dispose();
        assert(h.sync.schedule() === false);
        assert(h.sync.forceResync() === false);
        assert(h.sync.syncNow() === false);
        h.sync.clearPosition(w); // maintenance still works
        assert(!('_dtpPosition' in w));
        h.sync.clearOrder();
        h.sync.endStartupPhase();
    });

    it('never throws when every accessor is hostile', () => {
        const errors = [];
        const sync = createTaskbarSync({
            isEnabled: () => { throw new Error('x'); },
            getSpaces: () => { throw new Error('x'); },
            setTimeout: () => { throw new Error('x'); },
            clearTimeout: () => { throw new Error('x'); },
            scheduleIdle: () => { throw new Error('x'); },
            emitNudge: () => { throw new Error('x'); },
            getAllWindows: () => { throw new Error('x'); },
            logError: (...args) => errors.push(args.map(String).join(' ')),
        });
        sync.schedule();
        sync.forceResync();
        sync.syncNow();
        sync.beginStartupPhase();
        sync.endStartupPhase();
        sync.clearOrder();
        sync.clearPosition({});
        sync.dispose();
        assert(errors.length >= 1);
    });

    it('getState() reports scheduler state for diagnosis', () => {
        const h = makeSync({ config: FAST });
        const st = h.sync.getState();
        assert(typeof st.disposed === 'boolean');
        assert(typeof st.startupPhase === 'boolean');
        assert(typeof st.debouncePending === 'boolean');
        eq(typeof st.syncsRun, 'number');
        eq(typeof st.nudgesEmitted, 'number');
    });
});

// ---------------------------------------------------------------------------
// Regression scenario: login autostart burst (bugs/bugs.md §3.2)
// ---------------------------------------------------------------------------

describe('regression: login autostart burst (bugs/bugs.md §3.2)', () => {
    it('a late-enabled panel still converges to PaperWM order', () => {
        const brave1 = makeWindow(11);
        const brave2 = makeWindow(22);
        const obsidian = makeWindow(33);
        const windows = [brave1, brave2];
        const space = makeSpace(0, windows);

        const panel = { readyAt: 20, snapshots: [] };
        const h = makeSync({
            spaces: makeSpaces(space),
            config: { debounceMs: 5, startupResyncDelaysMs: [10, 20, 40], startupPhaseMs: 0 },
            onNudge: clock => {
                if (clock.now >= panel.readyAt) {
                    panel.snapshots.push([brave1, brave2, obsidian].map(w => w._dtpPosition));
                }
            },
        });

        h.sync.beginStartupPhase();          // extension enabled at login
        h.sync.schedule();                   // autostart window burst
        h.clock.advance(5);                  // first pass: panel not ready
        eq(h.env.nudges, 1);
        eq(panel.snapshots.length, 0);

        // Obsidian finishes launching slightly later and is placed.
        h.clock.advance(2);
        windows.push(obsidian);
        h.sync.schedule();                   // layout of the new window

        // Forced re-asserts from the startup chain keep arriving after the
        // panel became ready — this is what §3.2 needs (the plain signature
        // gate would have suppressed these).
        h.clock.advance(500);
        assert(panel.snapshots.length >= 1, 'panel observed at least one order');
        eq(ranks([brave1, brave2, obsidian]), [0, 1, 2]);

        // Chains are bounded: once settled, no further nudging.
        const settled = h.env.nudges;
        h.clock.advance(2000);
        eq(h.env.nudges, settled);
    });

    it('re-asserts even when the order never changes (late panel, single app)', () => {
        const w = makeWindow(1);
        const h = makeSync({
            spaces: makeSpaces(makeSpace(0, [w])),
            config: { debounceMs: 5, startupResyncDelaysMs: [10, 20, 40], startupPhaseMs: 0 },
        });
        h.sync.beginStartupPhase();
        h.sync.schedule();
        h.clock.advance(5);
        eq(h.env.nudges, 1); // early nudge; a taskbar enabling now never sees it
        h.clock.advance(1000);
        assert(h.env.nudges > 1, 'late taskbar receives forced re-asserts');
        // Exactly one forced pass per chain step (bounded — not per layout).
        eq(h.env.nudges, 1 + 3);
    });

    it('does not impose startup chains on a mid-session enable', () => {
        const w = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [w])), config: FAST });
        h.sync.schedule();               // no beginStartupPhase()
        h.clock.advance(2000);
        eq(h.env.nudges, 1);
        eq(h.sync.getState().startupChainsStarted, 0);
    });
});

// ---------------------------------------------------------------------------
// Nudge target: Dash-to-Panel's own deferred redisplay (bugs/bugs.md §1.1)
// ---------------------------------------------------------------------------

/** Panel stub exposing the DTP taskbar contract used by the nudge. */
function makePanel() {
    const calls = [];
    const taskbar = {
        _queueRedisplay() {
            calls.push(this);
        },
    };
    return { panel: { taskbar }, taskbar, calls };
}

describe('Dash-to-Panel nudge — target selection (bugs/bugs.md §1.1)', () => {
    it('queues the deferred redisplay on every panel', () => {
        const a = makePanel();
        const b = makePanel();
        const nudge = createDashToPanelNudge({ getPanels: () => [a.panel, b.panel] });
        assert(nudge() === true);
        eq(a.calls.length, 1);
        eq(b.calls.length, 1);
    });

    it('invokes _queueRedisplay with the taskbar as receiver', () => {
        const a = makePanel();
        const nudge = createDashToPanelNudge({ getPanels: () => [a.panel] });
        nudge();
        assert(a.calls[0] === a.taskbar);
    });

    it('accepts any iterable panel collection', () => {
        const a = makePanel();
        const nudge = createDashToPanelNudge({ getPanels: () => new Set([a.panel]) });
        assert(nudge() === true);
        eq(a.calls.length, 1);
    });

    it('skips panels without a taskbar or without _queueRedisplay', () => {
        const errors = [];
        const nudge = createDashToPanelNudge({
            getPanels: () => [null, {}, { taskbar: null }, { taskbar: {} },
                { taskbar: { _queueRedisplay: 42 } }],
            logError: (...args) => errors.push(args),
        });
        assert(nudge() === false);
        eq(errors.length, 0); // malformed panels are skipped, not errors
    });

    it('never lets one broken panel hide the others', () => {
        const good = makePanel();
        const bad = {
            taskbar: {
                _queueRedisplay() {
                    throw new Error('boom');
                },
            },
        };
        const errors = [];
        const nudge = createDashToPanelNudge({
            getPanels: () => [bad, good.panel],
            logError: (...args) => errors.push(args),
        });
        assert(nudge() === true);
        eq(good.calls.length, 1);
        eq(errors.length, 1);
    });

    it('returns false and logs when the panels accessor throws', () => {
        const errors = [];
        const nudge = createDashToPanelNudge({
            getPanels: () => { throw new Error('no DTP'); },
            logError: (...args) => errors.push(args),
        });
        assert(nudge() === false);
        eq(errors.length, 1);
    });

    it('is a silent no-op when Dash-to-Panel is absent', () => {
        for (const value of [null, undefined, []]) {
            const errors = [];
            const nudge = createDashToPanelNudge({
                getPanels: () => value,
                logError: (...args) => errors.push(args),
            });
            assert(nudge() === false);
            eq(errors.length, 0);
        }
        const bare = createDashToPanelNudge();
        assert(bare() === false); // no accessor configured: no-op, no throw
    });
});

describe('regression: scratch-window open stays gated (bugs/bugs.md §1.1)', () => {
    it('a scratch window that never joins a Space does not trigger a nudge', () => {
        const tiled = makeWindow(1);
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, [tiled])) });
        h.sync.schedule();
        h.clock.advance(50);
        eq(h.env.nudges, 1); // window lands in the strip: panel sorted once

        // Scratch window opens (winprop `scratch_layer`): it is `stick()`ed,
        // never joins a Space and is never stamped. `makeScratch()` schedules
        // a *gated* pass — the order signature is unchanged, so the panel
        // must not be re-sorted, and the shell main thread stays quiet.
        const scratch = makeWindow(2);
        h.sync.schedule();
        h.clock.advance(50);

        eq(scratch._dtpPosition, undefined);
        eq(h.env.nudges, 1);
    });

    it('a toggle to scratch (tiled window leaves the Space) still nudges once', () => {
        const tiled = makeWindow(1);
        const other = makeWindow(2);
        const windows = [tiled, other];
        const h = makeSync({ spaces: makeSpaces(makeSpace(0, windows)) });
        h.sync.schedule();
        h.clock.advance(50);
        eq(h.env.nudges, 1);

        // toggle(): makeScratch() removes it from the Space (which also
        // deletes its rank, tiling.js removeWindow/clearTaskbarPosition)
        // and schedules a pass. The signature changed, so the panel is
        // re-sorted exactly once (gated pass — no force needed).
        windows.splice(windows.indexOf(tiled), 1);
        delete tiled._dtpPosition;
        h.sync.schedule();
        h.clock.advance(50);

        eq(tiled._dtpPosition, undefined);
        eq(h.env.nudges, 2);
    });
});

export { FakeClock };
