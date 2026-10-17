/**
 * Minimal GJS-compatible test framework for paperwm-mod.
 *
 * Usage:
 *   import { describe, it, assert, eq, approx, throws, runAndExit } from './tests/harness.js';
 *
 *   describe('lib.findNext', () => {
 *     it('cycles to first value when none is larger', () => {
 *       eq(Lib.findNext(9, [1, 3, 5]), 1);
 *     });
 *   });
 *
 *   runAndExit();
 */

let suites = [];
let currentSuite = null;
let total = 0;
let passed = 0;
let failed = 0;
let skipped = 0;
let abortOnFail = false;

/** Register a test suite. */
export function describe(name, fn) {
    suites.push({ name, fn });
}

/** Register a test case within the most recent suite. */
export function it(name, fn) {
    if (currentSuite === null) {
        throw new Error(`it('${name}') used outside of describe()`);
    }
    currentSuite.tests.push({ name, fn });
}

/** Focus-only: run only suites/tests marked with `fit`/`ddescribe`. Not implemented; kept for API parity. */
export function fit() { /* noop */ }

/** Skip a suite. */
export function xdescribe(name, fn) {
    suites.push({ name, fn, skip: true });
}

/** Skip a test. */
export function xit(name) {
    if (currentSuite === null) {
        throw new Error(`xit('${name}') used outside of describe()`);
    }
    currentSuite.tests.push({ name, fn: null, skip: true });
}

/** Assert a condition is truthy. */
export function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message ?? '(no message)'}`);
    }
}

/** Deep equality for primitives and plain objects/arrays. */
export function eq(actual, expected, message) {
    const a = actual;
    const b = expected;
    let ok;
    if (a === b) {
        ok = true;
    } else if (Array.isArray(a) && Array.isArray(b)) {
        ok = a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    } else if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        ok = ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
    } else {
        ok = Object.is(a, b);
    }
    if (!ok) {
        throw new Error(
            `Expected ${json(expected)} but got ${json(actual)}${message ? ` — ${message}` : ''}`
        );
    }
    return ok;
}

/** Approximate numeric equality within epsilon. */
export function approx(actual, expected, epsilon, message) {
    if (typeof actual !== 'number' || typeof expected !== 'number') {
        throw new Error(`approx() requires numbers; got ${typeof actual} and ${typeof expected}`);
    }
    if (Math.abs(actual - expected) > epsilon) {
        throw new Error(
            `Expected ${expected} (within ±${epsilon}) but got ${actual}${message ? ` — ${message}` : ''}`
        );
    }
    return true;
}

/** Expect a function to throw. */
export function throws(fn, message) {
    let threw = false;
    let caught = null;
    try {
        fn();
    } catch (e) {
        threw = true;
        caught = e;
    }
    if (!threw) {
        throw new Error(`Expected function to throw${message ? ` (${message})` : ''} but it did not`);
    }
    return caught;
}

function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return Object.is(a, b);
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
        if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
        if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
}

function json(v) {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    try {
        return JSON.stringify(v);
    } catch (_e) {
        return String(v);
    }
}

function runSuite(suite) {
    currentSuite = { name: suite.name, tests: [] };
    suite.fn();
    const tests = currentSuite.tests;
    let suitePassed = 0;
    let suiteFailed = 0;
    let suiteSkipped = 0;

    print(`  Suite: ${suite.name}`);

    for (const t of tests) {
        total++;
        if (t.skip || t.fn === null) {
            skipped++;
            suiteSkipped++;
            print(`    - ${t.name}   SKIP`);
            continue;
        }
        try {
            t.fn();
            passed++;
            suitePassed++;
            print(`    ✓ ${t.name}`);
        } catch (e) {
            failed++;
            suiteFailed++;
            print(`    ✗ ${t.name}`);
            print(`      ${e}`);
            if (abortOnFail) {
                currentSuite = null;
                return false;
            }
        }
    }
    currentSuite = null;
    print(`  Suite results: ${suitePassed} passed, ${suiteFailed} failed, ${suiteSkipped} skipped`);
    return suiteFailed === 0;
}

export function setAbortOnFail(value) {
    abortOnFail = !!value;
}

/** Run all registered suites, print a summary, and exit with code 0 on success, 1 on failure. */
export function runAndExit() {
    let allOk = true;
    for (const suite of suites) {
        if (!runSuite(suite)) allOk = false;
    }
    print('');
    print(`========================================`);
    print(`TOTAL: ${total} tests, ${passed} passed, ${failed} failed, ${skipped} skipped`);
    if (failed > 0) {
        print(`RESULT: FAIL`);
        throw new Error(`Test suite failed: ${failed} test(s) did not pass`);
    } else {
        print(`RESULT: PASS`);
    }
}

export { total, passed, failed, skipped };
