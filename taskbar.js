/**
 * taskbar.js — Dash-to-Panel order synchronisation (asynchronous).
 *
 * PaperWM tiles in a spatial left-to-right order; Dash-to-Panel (DTP) sorts
 * ungrouped taskbar icons/previews by `MetaWindow.get_stable_sequence()`
 * (creation order) unless a `window._dtpPosition` override is present.
 * DTP's `getWindowStableSequence()` prefers `_dtpPosition`, and an app's
 * icon position is the minimum sequence among its windows. This module
 * mirrors PaperWM's spatial order into `_dtpPosition`, and nudges DTP to
 * re-sort by emitting `AppFavorites` `'changed'` (its `_queueRedisplay`
 * listener).
 *
 * ## Why a scheduler instead of direct calls
 *
 * The original implementation stamped synchronously from hot paths
 * (`Space.layout()`, `window-created`, floating add/remove). During login the
 * autostart burst (e.g. two Brave profiles + Obsidian) triggered a sync per
 * layout, while the nudge could fire before DTP finished enabling — leaving
 * icons missing or misordered with no later event to correct them
 * (`bugs/bugs.md` §3.2).
 *
 * Everything now goes through one debounced, idle-deferred scheduler:
 *
 *   call site ──schedule()──▶ debounce timer ──▶ idle callback ──▶ stamp + nudge
 *
 * - No taskbar work runs inside a signal handler or a layout pass.
 * - A window burst (login autostart) collapses into a single pass.
 * - While the shell is starting up, every pass arms a bounded chain of
 *   *forced* re-syncs (signature gate bypassed) so a DTP instance that was
 *   still enabling — or that painted an early snapshot — is corrected once
 *   it is certainly listening. See `beginStartupPhase()`.
 *
 * Note on threading: GNOME Shell JS has no usable worker model for GObject
 * state, so "async" here means *deferred out of the hot path* via the shell
 * main loop (GSource timeout + idle), never a synchronous pass in a signal
 * handler. Every callback re-checks `disposed`/enabled before touching
 * anything.
 *
 * ## Ordering rules (unchanged)
 *
 * - Spaces ordered by workspace index (insertion order on ties/bad indices).
 * - Within a space: tiled windows (`getWindows()`) before `_floating`.
 * - Ranks (`_dtpPosition`) are globally unique, starting at 0, contiguous.
 *
 * ## Testability
 *
 * All platform access is injected through `createTaskbarSync(deps)`, so the
 * whole scheduler/ordering behaviour is unit-tested in plain gjs — see
 * `tests/taskbar.test.js`. `tiling.js` wires the live shell adapters.
 */

/**
 * Tunables. `startupResyncDelaysMs` are the offsets (from chain start) of
 * the forced re-asserts armed by the first sync of each startup-burst
 * generation; `startupPhaseMs` bounds how long new generations may start.
 */
export const TaskbarSyncDefaults = Object.freeze({
    /** Quiet period after the last schedule() before a pass runs. */
    debounceMs: 50,
    /** Forced re-assert offsets (ms) while in the startup phase. */
    startupResyncDelaysMs: [1000, 3000, 8000],
    /** How long after beginStartupPhase() new chains may still be armed. */
    startupPhaseMs: 30000,
});

const noop = () => {};

/**
 * Create a taskbar order-sync controller.
 *
 * @param {object} [deps] Injected platform hooks. All optional; a controller
 *   without a timer backend can still be used for `clear*` maintenance but
 *   `schedule()` will be a logged no-op.
 * @param {() => boolean} [deps.isEnabled] `sync-taskbar-order` pref accessor.
 * @param {() => Map|null} [deps.getSpaces] Live spaces accessor (read at call
 *   time; must not be captured by value).
 * @param {(fn: Function, ms: number) => any} [deps.setTimeout] One-shot timer.
 * @param {(id: any) => void} [deps.clearTimeout] Cancel a timer.
 * @param {(fn: Function) => void} [deps.scheduleIdle] Defer to an idle
 *   callback; falls back to `setTimeout(fn, 0)` when omitted.
 * @param {() => void} [deps.emitNudge] Emit the taskbar re-sort signal.
 * @param {() => Array} [deps.getAllWindows] Global window sweep for clears.
 * @param {(...args: any[]) => void} [deps.logError] Error sink.
 * @param {Partial<typeof TaskbarSyncDefaults>} [deps.config] Tunables.
 * @returns Controller; see the returned object's JSDoc.
 */
export function createTaskbarSync(deps = {}) {
    const cfg = { ...TaskbarSyncDefaults, ...deps.config };
    const isEnabled = typeof deps.isEnabled === 'function' ? deps.isEnabled : () => false;
    const getSpaces = typeof deps.getSpaces === 'function' ? deps.getSpaces : () => null;
    const setTimeoutFn = typeof deps.setTimeout === 'function' ? deps.setTimeout : null;
    const clearTimeoutFn = typeof deps.clearTimeout === 'function' ? deps.clearTimeout : noop;
    let scheduleIdle = null;
    if (typeof deps.scheduleIdle === 'function') {
        scheduleIdle = deps.scheduleIdle;
    } else if (setTimeoutFn) {
        scheduleIdle = fn => setTimeoutFn(fn, 0);
    }
    const emitNudge = typeof deps.emitNudge === 'function' ? deps.emitNudge : noop;
    const getAllWindows = typeof deps.getAllWindows === 'function' ? deps.getAllWindows : () => [];
    const logError = typeof deps.logError === 'function'
        ? deps.logError
        : (...args) => console.error('PaperWM taskbar:', ...args);

    // --- scheduler state ---------------------------------------------------
    let debounceTimer = null;
    let pendingForce = false;
    let disposed = false;
    let lastSignature = null;

    // --- startup burst cover state ----------------------------------------
    let startupPhase = false;
    let startupPhaseTimer = null;
    let startupChainActive = false;
    let startupChainFinishing = false;
    let startupChainTimer = null;
    let startupChainIndex = 0;
    // Set for chain-driven forced passes so they never arm a new chain.
    let pendingChainStep = false;

    // --- stats (introspection for tests / debugging) -----------------------
    const stats = { syncsRun: 0, nudgesEmitted: 0, startupChainsStarted: 0 };

    /** Setting accessor that never throws. */
    function enabled() {
        try {
            return isEnabled() === true;
        } catch (_e) {
            return false;
        }
    }

    /** Never-throwing array coercion. */
    function safeArray(value) {
        try {
            if (Array.isArray(value)) {
                return value;
            }
            return value ? Array.from(value) : [];
        } catch (_e) {
            return [];
        }
    }

    /** Signature fallback for windows whose stable sequence throws. */
    function windowKey(w, pos) {
        try {
            return w.get_stable_sequence();
        } catch (_e) {
            try {
                return `id:${w.get_id?.() ?? pos}`;
            } catch (_e2) {
                return `pos:${pos}`;
            }
        }
    }

    /**
     * Stamp `_dtpPosition` on every window in PaperWM order and nudge the
     * taskbar if (and only if) the order signature changed. Synchronous by
     * design: it runs from the scheduled idle callback, never from a signal
     * handler. Returns true when a pass ran.
     */
    function stampAndNudge() {
        let allSpaces;
        try {
            const sp = getSpaces();
            if (!sp) {
                return false;
            }
            allSpaces = [...sp.values()];
        } catch (e) {
            logError('syncTaskbarOrder: cannot read spaces', e);
            return false;
        }

        try {
            // Defensive sort: a single dead workspace must never abort the
            // whole pass (that would leave every window with stale ranks).
            allSpaces.sort((a, b) => {
                let ai = 0, bi = 0;
                try {
                    ai = a?.workspace?.index?.() ?? 0;
                } catch (_e) { ai = 0; }
                try {
                    bi = b?.workspace?.index?.() ?? 0;
                } catch (_e) { bi = 0; }
                if (!Number.isFinite(ai)) {
                    ai = 0;
                }
                if (!Number.isFinite(bi)) {
                    bi = 0;
                }
                return ai - bi;
            });
        } catch (_e) { /* keep insertion order on sort failure */ }

        const signature = [];
        let pos = 0;
        for (const space of allSpaces) {
            if (!space) {
                continue;
            }
            let tiled = [];
            let floating = [];
            // One bad space must not hide the others.
            try {
                tiled = safeArray(space.getWindows?.());
            } catch (_e) {
                tiled = [];
            }
            try {
                floating = safeArray(space._floating);
            } catch (_e) {
                floating = [];
            }
            // Stamping and signature collection are isolated per window: a
            // throwing accessor must not skip the stamp and must not blind
            // the nudge gate.
            for (const w of tiled.concat(floating)) {
                if (!w) {
                    continue;
                }
                try {
                    w._dtpPosition = pos;
                } catch (_e) { /* ignore dead/read-only windows */ }
                signature.push(windowKey(w, pos));
                pos++;
            }
        }

        nudge(signature.join(','));
        stats.syncsRun++;
        return true;
    }

    /**
     * Emit the re-sort nudge unless the signature is unchanged (gate), and
     * record the signature. Returns true when the taskbar was nudged.
     */
    function nudge(signature) {
        if (signature === lastSignature) {
            return false;
        }
        lastSignature = signature;
        try {
            emitNudge();
            stats.nudgesEmitted++;
        } catch (e) {
            logError('nudgeTaskbarOrder failed', e);
        }
        return true;
    }

    /**
     * Run one full pass; `force` bypasses the signature gate. Only natural
     * passes (not startup-chain steps) may arm a new chain; a chain is
     * cleared once its final forced pass has run.
     */
    function runSync(force, chainStep = false) {
        if (disposed || !enabled()) {
            return false;
        }
        if (force) {
            lastSignature = null;
        }
        const ran = stampAndNudge();
        if (ran) {
            if (chainStep && startupChainFinishing) {
                startupChainFinishing = false;
                startupChainActive = false;
            }
            if (!chainStep && startupPhase) {
                armStartupChain();
            }
        }
        return ran;
    }

    /** Debounce timer fired: hand off to an idle callback. */
    function flush() {
        debounceTimer = null;
        const force = pendingForce;
        const chainStep = pendingChainStep;
        pendingForce = false;
        pendingChainStep = false;
        if (disposed || !scheduleIdle) {
            return;
        }
        try {
            scheduleIdle(() => {
                if (disposed) {
                    return;
                }
                runSync(force, chainStep);
            });
        } catch (e) {
            logError('scheduled taskbar sync failed', e);
        }
    }

    /** Cancel a queued debounce (leaves a pending force flag intact). */
    function cancelDebounce() {
        if (debounceTimer !== null) {
            try {
                clearTimeoutFn(debounceTimer);
            } catch (_e) { /* already fired */ }
            debounceTimer = null;
        }
    }

    /** Cancel a queued debounce and any pending force request. */
    function cancelPendingSync() {
        cancelDebounce();
        pendingForce = false;
    }

    /**
     * Schedule a debounced, idle-deferred order pass. Safe to call from any
     * signal handler / layout pass: returns immediately.
     */
    function schedule() {
        if (disposed || !enabled()) {
            return false;
        }
        if (!setTimeoutFn) {
            logError('scheduleTaskbarSync: no timer backend configured');
            return false;
        }
        cancelDebounce();
        try {
            debounceTimer = setTimeoutFn(flush, cfg.debounceMs);
        } catch (e) {
            debounceTimer = null;
            logError('scheduleTaskbarSync: timer failed', e);
            return false;
        }
        return true;
    }

    /** Run one pass right now (scheduled context only; used by tests). */
    function syncNow() {
        return runSync(false);
    }

    /**
     * Re-assert the order even when the signature is unchanged. Still goes
     * through the debounce/idle pipeline (resets the signature when the pass
     * runs so the nudge is unconditional). Returns true when a pass was
     * queued.
     */
    function forceResync() {
        if (disposed || !enabled()) {
            return false;
        }
        pendingChainStep = false;
        pendingForce = true;
        if (schedule()) {
            return true;
        }
        pendingForce = false;
        return false;
    }

    /** Chain-driven forced pass (never arms a new chain). */
    function forceChainResync() {
        if (disposed || !enabled()) {
            return false;
        }
        pendingForce = true;
        pendingChainStep = true;
        if (schedule()) {
            return true;
        }
        pendingForce = false;
        pendingChainStep = false;
        return false;
    }

    // --- startup burst cover ----------------------------------------------

    /** Arm the next forced re-assert of the current chain. */
    function scheduleNextStartupResync() {
        const delays = cfg.startupResyncDelaysMs;
        if (!Array.isArray(delays) || startupChainIndex >= delays.length) {
            // Last step already scheduled; its completed pass clears the
            // chain (see runSync) so a trailing natural pass cannot re-arm
            // an already-finished chain.
            return;
        }
        if (!setTimeoutFn || disposed) {
            startupChainActive = false;
            return;
        }
        const delay = delays[startupChainIndex++];
        const lastStep = startupChainIndex >= delays.length;
        try {
            startupChainTimer = setTimeoutFn(() => {
                startupChainTimer = null;
                if (disposed || !startupPhase) {
                    startupChainActive = false;
                    startupChainFinishing = false;
                    return;
                }
                if (lastStep) {
                    // Keep the chain active until this final forced pass has
                    // run, otherwise that pass would arm a fresh chain and
                    // the loop would never end.
                    startupChainFinishing = true;
                }
                if (!forceChainResync()) {
                    // Setting off / no backend: stop the chain.
                    startupChainActive = false;
                    startupChainFinishing = false;
                    return;
                }
                if (!lastStep) {
                    scheduleNextStartupResync();
                }
            }, delay);
        } catch (e) {
            startupChainTimer = null;
            startupChainActive = false;
            startupChainFinishing = false;
            logError('startup taskbar resync: timer failed', e);
        }
    }

    /**
     * Start (or restart) a bounded chain of forced re-asserts. Called after
     * each pass while the startup phase is active; a chain in flight is not
     * restarted, so the number of nudges per burst generation is bounded by
     * `startupResyncDelaysMs.length`.
     */
    function armStartupChain() {
        if (!startupPhase || disposed || startupChainActive) {
            return;
        }
        if (!setTimeoutFn || !Array.isArray(cfg.startupResyncDelaysMs) ||
            cfg.startupResyncDelaysMs.length === 0) {
            return;
        }
        startupChainActive = true;
        startupChainFinishing = false;
        startupChainIndex = 0;
        stats.startupChainsStarted++;
        scheduleNextStartupResync();
    }

    /**
     * Call at login-time enable. While active, each sync arms a bounded
     * forced-resync chain and the phase auto-ends after `startupPhaseMs`.
     * No-op when disposed.
     */
    function beginStartupPhase() {
        if (disposed) {
            return;
        }
        startupPhase = true;
        if (startupChainTimer !== null) {
            try {
                clearTimeoutFn(startupChainTimer);
            } catch (_e) { /* already fired */ }
            startupChainTimer = null;
        }
        startupChainActive = false;
        startupChainFinishing = false;
        startupChainIndex = 0;
        if (startupPhaseTimer !== null) {
            try {
                clearTimeoutFn(startupPhaseTimer);
            } catch (_e) { /* already fired */ }
            startupPhaseTimer = null;
        }
        if (setTimeoutFn && cfg.startupPhaseMs > 0) {
            try {
                startupPhaseTimer = setTimeoutFn(() => {
                    startupPhaseTimer = null;
                    endStartupPhase();
                }, cfg.startupPhaseMs);
            } catch (e) {
                startupPhaseTimer = null;
                logError('beginStartupPhase: timer failed', e);
            }
        }
    }

    /**
     * Stop arming new chains, cancel the pending chain step, and perform one
     * final forced re-assert so a panel that missed earlier nudges cannot
     * stay on a stale snapshot. Idempotent.
     */
    function endStartupPhase() {
        startupPhase = false;
        startupChainActive = false;
        startupChainFinishing = false;
        if (startupChainTimer !== null) {
            try {
                clearTimeoutFn(startupChainTimer);
            } catch (_e) { /* already fired */ }
            startupChainTimer = null;
        }
        if (startupPhaseTimer !== null) {
            try {
                clearTimeoutFn(startupPhaseTimer);
            } catch (_e) { /* already fired */ }
            startupPhaseTimer = null;
        }
        forceResync();
    }

    // --- overrides maintenance ---------------------------------------------

    /** Remove a single window's rank (scratch/sticky/never-tiled windows). */
    function clearPosition(metaWindow) {
        try {
            if (metaWindow && '_dtpPosition' in metaWindow) {
                delete metaWindow._dtpPosition;
            }
        } catch (_e) { /* ignore dead/read-only windows */ }
    }

    /**
     * Remove every `_dtpPosition` override and cancel any queued pass so a
     * late debounce cannot re-stamp after the override was removed (e.g.
     * setting turned off). Also sweeps windows that never joined a Space.
     */
    function clearOrder() {
        cancelPendingSync();
        lastSignature = null;

        let sp = null;
        try {
            sp = getSpaces();
        } catch (_e) {
            sp = null;
        }
        if (sp) {
            try {
                for (const space of sp.values()) {
                    if (!space) {
                        continue;
                    }
                    let stamped = [];
                    try {
                        stamped = safeArray(space.getWindows?.()).concat(
                            safeArray(space._floating));
                    } catch (_e) {
                        continue; // one bad space must not block the sweep
                    }
                    for (const w of stamped) {
                        if (!w) {
                            continue;
                        }
                        try {
                            if ('_dtpPosition' in w) {
                                delete w._dtpPosition;
                            }
                        } catch (_e) { /* ignore dead/read-only windows */ }
                    }
                }
            } catch (e) {
                logError('clearTaskbarOrder failed', e);
            }
        }

        // Sweep windows that never entered a Space (scratch/sticky/launcher
        // overlays with provisional ranks). Best-effort.
        let all = [];
        try {
            all = safeArray(getAllWindows());
        } catch (_e) {
            all = [];
        }
        for (const w of all) {
            if (!w) {
                continue;
            }
            try {
                if ('_dtpPosition' in w) {
                    delete w._dtpPosition;
                }
            } catch (_e) { /* ignore dead/read-only windows */ }
        }
    }

    /**
     * Stop all scheduled work and mark the controller dead (disable path).
     * Idempotent; queued idle callbacks self-cancel on the `disposed` check.
     */
    function dispose() {
        if (disposed) {
            return;
        }
        disposed = true;
        cancelPendingSync();
        pendingChainStep = false;
        startupPhase = false;
        startupChainActive = false;
        startupChainFinishing = false;
        if (startupChainTimer !== null) {
            try {
                clearTimeoutFn(startupChainTimer);
            } catch (_e) { /* already fired */ }
            startupChainTimer = null;
        }
        if (startupPhaseTimer !== null) {
            try {
                clearTimeoutFn(startupPhaseTimer);
            } catch (_e) { /* already fired */ }
            startupPhaseTimer = null;
        }
    }

    /** Snapshot for tests / debugging. */
    function getState() {
        return {
            disposed,
            startupPhase,
            startupChainActive,
            startupChainFinishing,
            startupChainIndex,
            debouncePending: debounceTimer !== null,
            pendingForce,
            pendingChainStep,
            lastSignature,
            ...stats,
        };
    }

    return {
        schedule,
        syncNow,
        forceResync,
        clearPosition,
        clearOrder,
        beginStartupPhase,
        endStartupPhase,
        dispose,
        getState,
    };
}
