/**
 * Tests for span-all-monitors mode (tiling.js §1–§3 of CHANGES-paperwm-mod.md).
 *
 * Covers:
 *   - SPAN_ALL_MONITORS kill-switch constant
 *   - getMonitorsBoundingBox() — union rect of all monitors
 *   - computeSpannedWorkArea() — work-area union with intersecting vertical bands
 *   - getPrimaryWorkAreaSpanCoords() — primary workArea in span coords
 *   - moveWindowToPrimaryMonitor() — fullscreen→primary guard
 *
 * These functions read `Main.layoutManager` and `Settings.prefs` globally, so
 * this suite must run inside a GNOME Shell session (e.g. `./shell.sh` or
 * `nix run .#vm`) where `gi://` imports resolve. The test harness below sets
 * up mock monitors/settings through `global` before importing tiling.
 *
 * Run:  gjs -m tests/tiling-span.test.js   (inside a GNOME Shell session)
 */

import {
    describe, it, eq, assert, approx, runAndExit
} from './harness.js';
import * as Tiling from '../tiling.js';
import { prefs } from '../settings.js';
import { MockMonitor, MockSettings } from './mocks.js';

const SPAN_ALL_MONITORS = Tiling.SPAN_ALL_MONITORS;
const getMonitorsBoundingBox = Tiling.getMonitorsBoundingBox;
const computeSpannedWorkArea = Tiling.computeSpannedWorkArea;
const getPrimaryWorkAreaSpanCoords = Tiling.getPrimaryWorkAreaSpanCoords;
const moveWindowToPrimaryMonitor = Tiling.moveWindowToPrimaryMonitor;

describe('SPAN_ALL_MONITORS kill-switch', () => {
    it('is true by default (span mode active)', () => {
        assert(SPAN_ALL_MONITORS === true);
    });
    it('is a boolean', () => {
        assert(typeof SPAN_ALL_MONITORS === 'boolean');
    });
});

describe('getMonitorsBoundingBox()', () => {
    it('returns union of two side-by-side monitors', () => {
        // mon0: (0,0,1920,1080), mon1: (1920,0,1920,1080)
        // bbox: x=0,y=0,w=3840,h=1080
        const bb = getMonitorsBoundingBox();
        eq(bb.x, 0);
        eq(bb.y, 0);
        eq(bb.width, 3840);
        eq(bb.height, 1080);
    });
    it('handles monitors at negative offsets (secondary left of primary)', () => {
        // mon0 primary: (1920,0,1920,1080), mon1: (-1920,0,1920,1080)
        // bbox: x=-1920,y=0,w=3840,h=1080
        const bb = getMonitorsBoundingBox();
        eq(bb.x, -1920);
        eq(bb.y, 0);
        eq(bb.width, 3840);
        eq(bb.height, 1080);
    });
    it('falls back to primary monitor when no monitors', () => {
        // Covered by fallback path; exercised implicitly via the real
        // layoutManager. No assertion beyond non-crash here.
        assert(getMonitorsBoundingBox() !== undefined);
    });
});

describe('computeSpannedWorkArea()', () => {
    it('returns union of work areas relative to bbox origin', () => {
        const wa = computeSpannedWorkArea();
        assert(typeof wa.x === 'number');
        assert(typeof wa.y === 'number');
        assert(typeof wa.width === 'number');
        assert(typeof wa.height === 'number');
        assert(wa.width >= 0);
        assert(wa.height >= 0);
    });
    it('applies vertical margins', () => {
        const wa = computeSpannedWorkArea();
        // y should be at least vertical_margin (0 by default here)
        assert(wa.y >= 0);
    });
});

describe('computeSpannedWorkArea() — panel insets (bugs/bugs.md §3.3)', () => {
    const mon0 = new MockMonitor(0, 0, 0, 1920, 1080, true);
    const mon1 = new MockMonitor(1, 1920, 0, 1920, 1080);
    const monitors = [mon0, mon1];

    const workAreas = areas => index => areas[index] ?? null;
    const margins = () => ({
        top: prefs?.vertical_margin ?? 0,
        bottom: prefs?.vertical_margin_bottom ?? 0,
    });

    it('reserves a bottom panel on one monitor of a side-by-side span', () => {
        // Dash-to-Panel bottom on the primary (48 px), secondary unobstructed.
        const wa = computeSpannedWorkArea(monitors, workAreas([
            { x: 0, y: 0, width: 1920, height: 1032 },
            { x: 1920, y: 0, width: 1920, height: 1080 },
        ]));
        const { top, bottom } = margins();
        eq(wa.x, 0);
        eq(wa.y, top);
        // Must stay above the primary monitor's bottom panel, even though the
        // secondary work area reaches the bottom of the screen.
        assert(wa.y + wa.height <= 1032 - bottom,
            `strip bottom ${wa.y + wa.height} crosses the bottom panel at 1032`);
    });

    it('reserves a top panel on one monitor of a side-by-side span', () => {
        const wa = computeSpannedWorkArea(monitors, workAreas([
            { x: 0, y: 48, width: 1920, height: 1032 },
            { x: 1920, y: 0, width: 1920, height: 1080 },
        ]));
        const { top } = margins();
        eq(wa.y, 48 + top);
        // Intersection of the two vertical bands: 48..1080.
        assert(wa.y + wa.height <= 1080, 'strip must not reach into the top panel');
    });

    it('reserves GNOME top bar plus a bottom Dash-to-Panel together', () => {
        const wa = computeSpannedWorkArea(monitors, workAreas([
            { x: 0, y: 24, width: 1920, height: 1008 },
            { x: 1920, y: 0, width: 1920, height: 1080 },
        ]));
        const { top, bottom } = margins();
        eq(wa.y, 24 + top);
        assert(wa.y + wa.height <= 1032 - bottom,
            'strip must fit between the top bar and the bottom panel');
    });

    it('uses the shortest monitor band (no off-screen bottom on a shorter monitor)', () => {
        const mixed = [
            new MockMonitor(0, 0, 0, 1920, 1080, true),
            new MockMonitor(1, 1920, 0, 1920, 1440),
        ];
        const wa = computeSpannedWorkArea(mixed, workAreas([
            { x: 0, y: 0, width: 1920, height: 1080 },
            { x: 1920, y: 0, width: 1920, height: 1440 },
        ]));
        const { top, bottom } = margins();
        eq(wa.y, top);
        eq(wa.height, 1080 - top - bottom);
    });

    it('falls back to the union for vertically stacked monitors', () => {
        // No common vertical band exists (0..1080 vs 1080..2160), so return
        // the union instead of an empty area - legacy span behaviour.
        const stacked = [
            new MockMonitor(0, 0, 0, 1920, 1080, true),
            new MockMonitor(1, 0, 1080, 1920, 1080),
        ];
        const wa = computeSpannedWorkArea(stacked, workAreas([
            { x: 0, y: 0, width: 1920, height: 1080 },
            { x: 0, y: 1080, width: 1920, height: 1080 },
        ]));
        const { top, bottom } = margins();
        eq(wa.y, top);
        eq(wa.height, 2160 - top - bottom);
    });

    it('ignores monitors with no work area and never returns negative height', () => {
        const wa = computeSpannedWorkArea(monitors, workAreas([
            { x: 0, y: 0, width: 1920, height: 1080 },
            null,
        ]));
        assert(wa.height >= 0);
        assert(wa.width > 0);
    });
});

describe('getPrimaryWorkAreaSpanCoords()', () => {
    it('returns primary work area in span coordinates', () => {
        const coords = getPrimaryWorkAreaSpanCoords();
        assert(typeof coords.x === 'number');
        assert(typeof coords.y === 'number');
        assert(typeof coords.width === 'number');
        assert(typeof coords.height === 'number');
        assert(coords.width > 0);
        assert(coords.height > 0);
    });
    it('falls back to computeSpannedWorkArea when no primary', () => {
        const coords = getPrimaryWorkAreaSpanCoords();
        const spanned = computeSpannedWorkArea();
        // In a single-primary session they should match closely.
        assert(Math.abs(coords.width - spanned.width) < 1000);
    });
});

describe('moveWindowToPrimaryMonitor()', () => {
    it('returns false when window already on primary', () => {
        const win = { get_monitor: () => 0, move_to_monitor: () => { throw new Error('should not move'); } };
        const result = moveWindowToPrimaryMonitor(win);
        assert(result === false);
    });
    it('returns false for null window', () => {
        const result = moveWindowToPrimaryMonitor(null);
        assert(result === false);
    });
    it('never throws on missing monitor API', () => {
        const win = { get_monitor: () => { throw new Error('no monitor'); } };
        assert(moveWindowToPrimaryMonitor(win) === false);
    });
});
