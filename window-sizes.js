/**
 * window-sizes.js — remember per-application tiled window sizes.
 *
 * PaperWM derives a tiled window's size from its current frame at layout
 * time (`Space.layout()`), so after a logout/login — when applications
 * re-create their windows — every window starts at whatever size the
 * application picks. This module records the last tiled width/height per
 * application and lets `tiling.js` apply it once, on the window's first
 * layout after a restart.
 *
 * Identity is the application, not the window instance: GTK/sandbox app id
 * when available, otherwise `wm_class` (lower-cased). GNOME does not expose a
 * window identity that is stable across application restarts, and window
 * titles change too often to be useful. Explicit `preferredWidth` winprops
 * still win over a learned size.
 *
 * Storage is injected (`read`/`write` callbacks); `tiling.js` wires the
 * GSettings key. All platform hooks are optional so the whole store is
 * unit-tested in plain gjs — see `tests/window-sizes.test.js`.
 */

export const WindowSizeDefaults = Object.freeze({
    /** Bump when the on-disk/GSettings shape changes incompatibly. */
    version: 1,
    /** Quiet period before a batch of size changes is persisted. */
    debounceMs: 1000,
    /** Keep the remembered set bounded; least-recently-updated is evicted. */
    maxEntries: 128,
    /** Reject nonsense values from stale/corrupt state. */
    minSize: 1,
    maxSize: 100000,
});

const noop = () => {};

/** Normalize a window identity into a stable storage key. */
export function normalizeWindowSizeKey(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const key = value.trim().toLowerCase();
    return key.length > 0 ? key.slice(0, 256) : null;
}

/**
 * Return the persistence key for a `Meta.Window`.
 *
 * Prefers the GTK/sandbox app id (stable per application), then falls back to
 * `wm_class`. Returns `null` when neither is available.
 *
 * @param {object|null|undefined} metaWindow
 * @returns {string|null}
 */
export function windowSizeKey(metaWindow) {
    if (!metaWindow) {
        return null;
    }
    const call = name => {
        try {
            return typeof metaWindow[name] === 'function' ? metaWindow[name]() : null;
        } catch (_e) {
            return null;
        }
    };
    let wmClass = null;
    try {
        wmClass = metaWindow.wm_class ?? null;
    } catch (_e) {
        wmClass = null;
    }
    const appId = call('get_gtk_application_id') || call('get_sandboxed_app_id');
    return normalizeWindowSizeKey(appId || wmClass || call('get_wm_class_instance'));
}

function validSize(value, config) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return null;
    }
    const rounded = Math.round(n);
    if (rounded < config.minSize || rounded > config.maxSize) {
        return null;
    }
    return rounded;
}

/**
 * Parse persisted size state. Unknown versions and malformed entries are
 * ignored rather than throwing, so a corrupt key can never break startup.
 *
 * @param {string|null|undefined} text
 * @param {typeof WindowSizeDefaults} [config]
 * @returns {Map<string, {width: number, height: number, updated: number}>}
 */
export function decodeWindowSizes(text, config = WindowSizeDefaults) {
    const sizes = new Map();
    if (!text || typeof text !== 'string') {
        return sizes;
    }
    let data;
    try {
        data = JSON.parse(text);
    } catch (_e) {
        return sizes;
    }
    if (!data || typeof data !== 'object') {
        return sizes;
    }
    if (data.version !== undefined && data.version !== config.version) {
        return sizes;
    }
    const raw = data.sizes && typeof data.sizes === 'object' ? data.sizes : data;
    for (const [rawKey, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object') {
            continue;
        }
        const key = normalizeWindowSizeKey(rawKey);
        const width = validSize(value.width, config);
        const height = validSize(value.height, config);
        if (!key || width === null || height === null) {
            continue;
        }
        const updated = Number.isFinite(value.updated) ? value.updated : 0;
        sizes.set(key, { width, height, updated });
    }
    return sizes;
}

/**
 * Serialize size state. An empty map is written as an empty string so the
 * GSettings key returns to its default instead of holding `{}` forever.
 *
 * @param {Map<string, {width: number, height: number, updated?: number}>} sizes
 * @param {typeof WindowSizeDefaults} [config]
 * @returns {string}
 */
export function encodeWindowSizes(sizes, config = WindowSizeDefaults) {
    if (!sizes || sizes.size === 0) {
        return '';
    }
    const out = {};
    for (const [rawKey, value] of sizes) {
        const key = normalizeWindowSizeKey(rawKey);
        const width = validSize(value?.width, config);
        const height = validSize(value?.height, config);
        if (!key || width === null || height === null) {
            continue;
        }
        out[key] = {
            width,
            height,
            updated: Number.isFinite(value.updated) ? value.updated : 0,
        };
    }
    if (Object.keys(out).length === 0) {
        return '';
    }
    return JSON.stringify({ version: config.version, sizes: out });
}

/**
 * Create a size memory store.
 *
 * @param {object} [deps]
 * @param {() => boolean} [deps.isEnabled] Setting accessor (default: enabled).
 * @param {() => string} [deps.read] Load persisted state.
 * @param {(text: string) => void} [deps.write] Persist state.
 * @param {(fn: Function, ms: number) => any} [deps.setTimeout] One-shot timer.
 * @param {(id: any) => void} [deps.clearTimeout] Cancel a timer.
 * @param {() => number} [deps.now] Clock used for LRU eviction.
 * @param {(...args: any[]) => void} [deps.logError] Error sink.
 * @param {Partial<typeof WindowSizeDefaults>} [deps.config] Tunables.
 */
export function createWindowSizeStore(deps = {}) {
    const config = { ...WindowSizeDefaults, ...deps.config };
    const isEnabled = typeof deps.isEnabled === 'function'
        ? deps.isEnabled
        : () => true;
    const read = typeof deps.read === 'function' ? deps.read : () => '';
    const write = typeof deps.write === 'function' ? deps.write : noop;
    const setTimeoutFn = typeof deps.setTimeout === 'function' ? deps.setTimeout : null;
    const clearTimeoutFn = typeof deps.clearTimeout === 'function' ? deps.clearTimeout : noop;
    const now = typeof deps.now === 'function' ? deps.now : () => Date.now();
    const logError = typeof deps.logError === 'function'
        ? deps.logError
        : (...args) => console.error('PaperWM window sizes:', ...args);

    const sizes = new Map();
    let timer = null;
    let dirty = false;
    let disposed = false;

    function enabled() {
        try {
            return isEnabled() !== false;
        } catch (_e) {
            return false;
        }
    }

    function evict() {
        while (sizes.size > config.maxEntries) {
            let oldestKey = null;
            let oldest = Infinity;
            for (const [key, value] of sizes) {
                if (value.updated < oldest) {
                    oldest = value.updated;
                    oldestKey = key;
                }
            }
            if (oldestKey === null) {
                break;
            }
            sizes.delete(oldestKey);
        }
    }

    function flush() {
        if (timer !== null) {
            try {
                clearTimeoutFn(timer);
            } catch (_e) { /* best-effort */ }
            timer = null;
        }
        if (!dirty) {
            return;
        }
        dirty = false;
        try {
            write(encodeWindowSizes(sizes, config));
        } catch (e) {
            logError('failed to persist window sizes:', e);
        }
    }

    function schedule() {
        dirty = true;
        if (!setTimeoutFn || timer !== null) {
            return;
        }
        timer = setTimeoutFn(() => {
            timer = null;
            flush();
        }, config.debounceMs);
    }

    return {
        /** Load persisted state, replacing the in-memory map. */
        load() {
            sizes.clear();
            dirty = false;
            let text = '';
            try {
                text = read();
            } catch (e) {
                logError('failed to read window sizes:', e);
            }
            for (const [key, value] of decodeWindowSizes(text, config)) {
                sizes.set(key, value);
            }
            return this;
        },

        /** Return a copy of a remembered size, or `null`. */
        get(key) {
            const normalized = normalizeWindowSizeKey(key);
            if (!normalized) {
                return null;
            }
            const value = sizes.get(normalized);
            return value ? { width: value.width, height: value.height } : null;
        },

        /**
         * Remember a window's tiled size. Returns `true` when the value
         * changed (and a write was scheduled).
         */
        remember(key, width, height) {
            if (disposed || !enabled()) {
                return false;
            }
            const normalized = normalizeWindowSizeKey(key);
            const w = validSize(width, config);
            const h = validSize(height, config);
            if (!normalized || w === null || h === null) {
                return false;
            }
            const existing = sizes.get(normalized);
            if (existing && existing.width === w && existing.height === h) {
                return false;
            }
            sizes.set(normalized, { width: w, height: h, updated: now() });
            evict();
            schedule();
            return true;
        },

        /** Write pending changes immediately. */
        flush,

        /** Flush and stop accepting updates (call from `disable()`). */
        dispose() {
            if (disposed) {
                return;
            }
            flush();
            disposed = true;
        },

        /** Number of remembered applications (tests/diagnostics). */
        get size() {
            return sizes.size;
        },

        /** Copy of the remembered map (tests/diagnostics). */
        entries() {
            return new Map(sizes);
        },
    };
}
