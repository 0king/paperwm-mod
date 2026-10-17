/**
 * Tests for navigator discrete-navigation logic (navigator.js).
 *
 * Covers:
 *   - primaryModifier(mask) — isolates the primary modifier bit
 *
 * navigator.js reads `Main.overview`, `Tiling.spaces`, `Utils.Signals`
 * globally, so this suite runs inside a GNOME Shell session.
 *
 * Run:  gjs -m tests/navigator.test.js   (inside a GNOME Shell session)
 */

import {
    describe, it, eq, assert, runAndExit
} from './harness.js';
import * as Navigator from '../navigator.js';

const primaryModifier = Navigator.primaryModifier;

describe('primaryModifier()', () => {
    it('returns 0 for mask 0', () => {
        eq(primaryModifier(0), 0);
    });
    it('returns the primary (lowest set) bit for single-bit masks', () => {
        eq(primaryModifier(1), 1);
        eq(primaryModifier(2), 2);
        eq(primaryModifier(4), 4);
        eq(primaryModifier(8), 8);
    });
    it('isolates the lowest set bit for combined masks', () => {
        eq(primaryModifier(1 | 2), 1);   // Shift + Ctrl → Shift (bit 1)
        eq(primaryModifier(2 | 4), 2);   // Ctrl + Alt → Ctrl (bit 2)
        eq(primaryModifier(1 | 4 | 8), 1); // Shift is primary
        eq(primaryModifier(16 | 32), 16);  // higher bits
    });
    it('handles large combined masks', () => {
        eq(primaryModifier(0b101010), 0b10); // lowest set bit
        eq(primaryModifier(0b1000000), 0b1000000);
    });
});
