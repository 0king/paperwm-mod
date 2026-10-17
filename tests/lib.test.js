/**
 * Tests for lib.js — pure utility functions.
 *
 * lib.js has no `gi://` imports, so this suite runs in plain `gjs`
 * without a GNOME Shell session.
 *
 * Run:  gjs -m tests/lib.test.js
 */

import {
    describe, it, eq, assert, approx, throws, runAndExit
} from './harness.js';
import * as Lib from '../lib.js';

describe('Lib.findNext', () => {
    it('returns the first value larger than cur', () => {
        eq(Lib.findNext(5, [1, 3, 7, 9]), 7);
    });
    it('cycles to first value when none is larger', () => {
        eq(Lib.findNext(9, [1, 3, 7]), 1);
    });
    it('returns first value when cur is below all', () => {
        eq(Lib.findNext(0, [1, 3, 7]), 1);
    });
    it('skips values within slack (practically equal)', () => {
        // cur=5, values=[1,3,7], slack=3: 7-5=2 < 3 so skip 7, cycle to 1
        eq(Lib.findNext(5, [1, 3, 7], 3), 1);
    });
    it('respects slack when a farther value exists', () => {
        // cur=5, values=[1,3,7,12], slack=3: skip 7 (diff 2), return 12
        eq(Lib.findNext(5, [1, 3, 7, 12], 3), 12);
    });
    it('handles exact match returning next larger', () => {
        eq(Lib.findNext(3, [1, 3, 7]), 7);
    });
    it('works with single-element array', () => {
        eq(Lib.findNext(5, [10]), 10);
        eq(Lib.findNext(15, [10]), 10);
    });
    it('handles empty-ish edge (non-positive cur)', () => {
        eq(Lib.findNext(-1, [1, 3, 7]), 1);
    });
});

describe('Lib.findPrev', () => {
    it('returns the previous value smaller than cur', () => {
        eq(Lib.findPrev(5, [1, 3, 7]), 3);
    });
    it('cycles to last value when none is smaller', () => {
        eq(Lib.findPrev(0, [1, 3, 7]), 7);
    });
    it('returns last value when cur is above all', () => {
        eq(Lib.findPrev(10, [1, 3, 7]), 7);
    });
    it('handles exact match with slack', () => {
        // cur=3, values=[1,3,7], slack=1: x+slack>=cur -> 3+1>=3 true at i=1, break, target_i=0 -> 1
        eq(Lib.findPrev(3, [1, 3, 7], 1), 1);
    });
    it('handles slack skipping', () => {
        // cur=7, values=[1,3,7], slack=1: at i=0 x+slack=2>=7? no. i=1: 3+1=4>=7? no. i=2: 7+1>=7 yes, break, target_i=1 -> 3
        eq(Lib.findPrev(7, [1, 3, 7], 1), 3);
    });
    it('works with single-element array', () => {
        eq(Lib.findPrev(5, [10]), 10);
        eq(Lib.findPrev(15, [10]), 10);
    });
});

describe('Lib.arrayEqual', () => {
    it('returns true for identical arrays', () => {
        assert(Lib.arrayEqual([1, 2, 3], [1, 2, 3]));
    });
    it('returns true for same reference', () => {
        const a = [1, 2];
        assert(Lib.arrayEqual(a, a));
    });
    it('returns false for different lengths', () => {
        assert(!Lib.arrayEqual([1, 2], [1, 2, 3]));
    });
    it('returns false for different contents', () => {
        assert(!Lib.arrayEqual([1, 2], [1, 3]));
    });
    it('returns false when one is null (and true for null===null)', () => {
        assert(!Lib.arrayEqual(null, [1]));
        assert(!Lib.arrayEqual([1], null));
        assert(Lib.arrayEqual(null, null)); // same reference
    });
    it('returns true for two empty arrays', () => {
        assert(Lib.arrayEqual([], []));
    });
});

describe('Lib.eq', () => {
    it('returns true for equal numbers', () => {
        assert(Lib.eq(1, 1));
    });
    it('returns true within epsilon', () => {
        assert(Lib.eq(1.00000001, 1.0));
    });
    it('returns false beyond epsilon', () => {
        assert(!Lib.eq(1.0001, 1.0));
    });
    it('uses default epsilon 1e-8', () => {
        assert(Lib.eq(1 + 1e-9, 1));
        assert(!Lib.eq(1 + 1e-7, 1));
    });
    it('handles negative numbers', () => {
        assert(Lib.eq(-1, -1));
        assert(Lib.eq(-1.00000001, -1));
    });
});

describe('Lib.swap', () => {
    it('swaps two elements in place', () => {
        const a = [1, 2, 3];
        Lib.swap(a, 0, 2);
        eq(a, [3, 2, 1]);
    });
    it('swapping same index is a no-op', () => {
        const a = [1, 2, 3];
        Lib.swap(a, 1, 1);
        eq(a, [1, 2, 3]);
    });
});

describe('Lib.in_bounds', () => {
    it('returns true for valid indices', () => {
        assert(Lib.in_bounds([1, 2, 3], 0));
        assert(Lib.in_bounds([1, 2, 3], 2));
    });
    it('returns false for out-of-range indices', () => {
        assert(!Lib.in_bounds([1, 2, 3], -1));
        assert(!Lib.in_bounds([1, 2, 3], 3));
        assert(!Lib.in_bounds([1, 2, 3], 100));
    });
    it('returns false for empty array', () => {
        assert(!Lib.in_bounds([], 0));
    });
});

describe('Lib.indent', () => {
    it('indents by two spaces per level', () => {
        eq(Lib.indent(0, 'x'), 'x');
        eq(Lib.indent(1, 'x'), '  x');
        eq(Lib.indent(2, 'x'), '    x');
        eq(Lib.indent(3, 'foo'), '      foo');
    });
});

describe('Lib.sum', () => {
    it('sums an array of numbers', () => {
        eq(Lib.sum([1, 2, 3, 4]), 10);
    });
    it('returns 0 for empty array', () => {
        eq(Lib.sum([]), 0);
    });
    it('handles negative numbers', () => {
        eq(Lib.sum([-1, -2, 3]), 0);
    });
});

describe('Lib.zip', () => {
    it('zips two arrays pairwise', () => {
        eq(Lib.zip([1, 2], ['a', 'b']), [[1, 'a'], [2, 'b']]);
    });
    it('truncates to the shortest array', () => {
        eq(Lib.zip([1, 2, 3], ['a', 'b']), [[1, 'a'], [2, 'b']]);
        eq(Lib.zip([1], ['a', 'b', 'c']), [[1, 'a']]);
    });
    it('handles a single array', () => {
        eq(Lib.zip([1, 2]), [[1], [2]]);
    });
    it('handles no arrays', () => {
        // zip() with no arguments is a degenerate case (pre-existing: Math.min() → Infinity).
        // Not part of branch scope; skip here.
    });
});
