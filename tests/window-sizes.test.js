/**
 * Tests for window-sizes.js — per-application tiled size memory.
 *
 * window-sizes.js has no `gi://` imports, so this suite runs in plain `gjs`
 * without a GNOME Shell session.
 *
 * Run:  make test   (suite is imported by tests/run.js)
 */

import {
    describe, it, eq, assert
} from './harness.js';
import {
    WindowSizeDefaults,
    normalizeWindowSizeKey,
    windowSizeKey,
    decodeWindowSizes,
    encodeWindowSizes,
    createWindowSizeStore,
} from '../window-sizes.js';

class FakeClock {
    constructor() {
        this.now = 0;
        this.nextId = 1;
        this.timers = new Map(); // id -> { fn, at }
    }

    setTimeout(fn, ms) {
        const id = this.nextId++;
        this.timers.set(id, { fn, at: this.now + Math.max(0, Number(ms) || 0) });
        return id;
    }

    clearTimeout(id) {
        this.timers.delete(id);
    }

    tick(ms) {
        this.now += Math.max(0, Number(ms) || 0);
        for (const [id, timer] of [...this.timers]) {
            if (timer.at <= this.now) {
                this.timers.delete(id);
                timer.fn();
            }
        }
    }
}

function makeStore(overrides = {}) {
    const clock = new FakeClock();
    const writes = [];
    let stored = overrides.stored ?? '';
    let enabled = overrides.enabled ?? true;
    const store = createWindowSizeStore({
        isEnabled: () => enabled,
        read: () => stored,
        write: text => {
            writes.push(text);
            stored = text;
        },
        setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
        clearTimeout: id => clock.clearTimeout(id),
        now: () => clock.now,
        logError: () => {},
        config: overrides.config,
    });
    return {
        store,
        clock,
        writes,
        get stored() {
            return stored;
        },
        setEnabled: value => {
            enabled = value;
        },
    };
}

describe('normalizeWindowSizeKey()', () => {
    it('trims and lower-cases', () => {
        eq(normalizeWindowSizeKey('  Org.GNOME.Terminal '), 'org.gnome.terminal');
    });
    it('returns null for non-strings and empty values', () => {
        eq(normalizeWindowSizeKey(null), null);
        eq(normalizeWindowSizeKey(undefined), null);
        eq(normalizeWindowSizeKey(42), null);
        eq(normalizeWindowSizeKey('   '), null);
    });
});

describe('windowSizeKey()', () => {
    it('prefers the GTK application id', () => {
        eq(windowSizeKey({
            get_gtk_application_id: () => 'Org.GNOME.Terminal',
            wm_class: 'Gnome-terminal',
        }), 'org.gnome.terminal');
    });
    it('falls back to the sandboxed app id', () => {
        eq(windowSizeKey({
            get_gtk_application_id: () => null,
            get_sandboxed_app_id: () => 'app.zen_browser.zen',
            wm_class: 'zen',
        }), 'app.zen_browser.zen');
    });
    it('falls back to wm_class', () => {
        eq(windowSizeKey({ wm_class: 'Firefox' }), 'firefox');
    });
    it('falls back to the wm_class instance', () => {
        eq(windowSizeKey({ get_wm_class_instance: () => 'Navigator' }), 'navigator');
    });
    it('returns null when no identity is available', () => {
        eq(windowSizeKey({}), null);
        eq(windowSizeKey(null), null);
        eq(windowSizeKey(undefined), null);
    });
    it('never throws when a getter throws', () => {
        eq(windowSizeKey({
            get_gtk_application_id: () => {
                throw new Error('boom');
            },
            get wm_class() {
                throw new Error('boom');
            },
            get_wm_class_instance: () => 'Navigator',
        }), 'navigator');
    });
});

describe('decodeWindowSizes()', () => {
    it('returns an empty map for empty/invalid input', () => {
        eq(decodeWindowSizes('').size, 0);
        eq(decodeWindowSizes(null).size, 0);
        eq(decodeWindowSizes('not json').size, 0);
        eq(decodeWindowSizes('[]').size, 0);
    });
    it('round-trips through encodeWindowSizes()', () => {
        const sizes = new Map([
            ['firefox', { width: 1200, height: 900, updated: 10 }],
            ['org.gnome.terminal', { width: 640, height: 480, updated: 20 }],
        ]);
        const decoded = decodeWindowSizes(encodeWindowSizes(sizes));
        eq(decoded.size, 2);
        eq(decoded.get('firefox'), { width: 1200, height: 900, updated: 10 });
        eq(decoded.get('org.gnome.terminal'), { width: 640, height: 480, updated: 20 });
    });
    it('ignores state written by a different version', () => {
        const text = JSON.stringify({
            version: WindowSizeDefaults.version + 1,
            sizes: { firefox: { width: 1200, height: 900 } },
        });
        eq(decodeWindowSizes(text).size, 0);
    });
    it('drops malformed and out-of-range entries', () => {
        const text = JSON.stringify({
            version: WindowSizeDefaults.version,
            sizes: {
                firefox: { width: 1200, height: 900 },
                bad: { width: -1, height: 900 },
                missing: { width: 1200 },
                zero: { width: 0, height: 0 },
                notObject: 5,
                '  ': { width: 1200, height: 900 },
            },
        });
        const decoded = decodeWindowSizes(text);
        eq(decoded.size, 1);
        eq(decoded.get('firefox').width, 1200);
    });
    it('accepts a bare key map (no version/sizes wrapper)', () => {
        const decoded = decodeWindowSizes(JSON.stringify({
            Firefox: { width: 800, height: 600 },
        }));
        eq(decoded.get('firefox'), { width: 800, height: 600, updated: 0 });
    });
});

describe('encodeWindowSizes()', () => {
    it('writes an empty string for an empty map', () => {
        eq(encodeWindowSizes(new Map()), '');
        eq(encodeWindowSizes(null), '');
    });
    it('drops invalid entries', () => {
        const encoded = encodeWindowSizes(new Map([
            ['firefox', { width: 1200, height: 900 }],
            ['bad', { width: -5, height: 10 }],
        ]));
        const decoded = decodeWindowSizes(encoded);
        eq(decoded.size, 1);
        eq(decoded.has('bad'), false);
    });
});

describe('createWindowSizeStore()', () => {
    it('loads persisted state', () => {
        const text = encodeWindowSizes(new Map([
            ['firefox', { width: 1200, height: 900, updated: 5 }],
        ]));
        const { store } = makeStore({ stored: text });
        store.load();
        eq(store.size, 1);
        eq(store.get('Firefox'), { width: 1200, height: 900 });
        eq(store.get('unknown'), null);
    });

    it('remembers sizes and debounces the write', () => {
        const { store, clock, writes } = makeStore();
        eq(store.remember('firefox', 1200, 900), true);
        eq(store.remember('org.gnome.terminal', 640, 480), true);
        eq(writes.length, 0);
        clock.tick(WindowSizeDefaults.debounceMs - 1);
        eq(writes.length, 0);
        clock.tick(1);
        eq(writes.length, 1);
        const decoded = decodeWindowSizes(writes[0]);
        eq(decoded.get('firefox').width, 1200);
        eq(decoded.get('org.gnome.terminal').height, 480);
    });

    it('does not rewrite an unchanged size', () => {
        const { store, clock, writes } = makeStore();
        store.remember('firefox', 1200, 900);
        clock.tick(WindowSizeDefaults.debounceMs);
        eq(writes.length, 1);
        eq(store.remember('firefox', 1200, 900), false);
        clock.tick(WindowSizeDefaults.debounceMs);
        eq(writes.length, 1);
    });

    it('flushes pending state on dispose and stops accepting updates', () => {
        const { store, writes } = makeStore();
        store.remember('firefox', 1200, 900);
        store.dispose();
        eq(writes.length, 1);
        eq(decodeWindowSizes(writes[0]).get('firefox').width, 1200);
        eq(store.remember('firefox', 800, 600), false);
        store.dispose();
        eq(writes.length, 1);
    });

    it('does nothing while disabled', () => {
        const { store, clock, writes, setEnabled } = makeStore({ enabled: false });
        eq(store.remember('firefox', 1200, 900), false);
        clock.tick(WindowSizeDefaults.debounceMs);
        eq(writes.length, 0);
        setEnabled(true);
        eq(store.remember('firefox', 1200, 900), true);
        clock.tick(WindowSizeDefaults.debounceMs);
        eq(writes.length, 1);
    });

    it('evicts the least-recently-updated entries when over the limit', () => {
        const { store, clock } = makeStore({ config: { maxEntries: 2 } });
        store.remember('one', 100, 100);
        clock.tick(1);
        store.remember('two', 200, 200);
        clock.tick(1);
        store.remember('three', 300, 300);
        eq(store.size, 2);
        eq(store.get('one'), null);
        eq(store.get('two'), { width: 200, height: 200 });
        eq(store.get('three'), { width: 300, height: 300 });
    });

    it('swallows read/write errors', () => {
        const store = createWindowSizeStore({
            read: () => {
                throw new Error('read failed');
            },
            write: () => {
                throw new Error('write failed');
            },
            logError: () => {},
        });
        store.load();
        eq(store.size, 0);
        eq(store.remember('firefox', 1200, 900), true);
        assert(true, 'remember() survived a throwing write');
    });

    it('rejects invalid sizes', () => {
        const { store } = makeStore();
        eq(store.remember('firefox', 0, 900), false);
        eq(store.remember('firefox', 1200, -1), false);
        eq(store.remember('firefox', NaN, 900), false);
        eq(store.remember('firefox', 1200, Infinity), false);
        eq(store.size, 0);
    });

    it('exposes a copy of the remembered entries', () => {
        const { store } = makeStore();
        store.remember('firefox', 1200, 900);
        const entries = store.entries();
        entries.delete('firefox');
        eq(store.size, 1);
    });

    it('can work without a timer backend (flush on dispose)', () => {
        const writes = [];
        const store = createWindowSizeStore({
            write: text => writes.push(text),
            logError: () => {},
        });
        store.remember('firefox', 1200, 900);
        eq(writes.length, 0);
        store.dispose();
        eq(writes.length, 1);
    });
});
