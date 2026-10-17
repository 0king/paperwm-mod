/**
 * Mock objects for paperwm-mod tests.
 *
 * These provide stand-ins for GNOME Shell / Mutter objects so that the
 * pure-logic portions of tiling.js (and other modules) can be exercised
 * without a full shell session. Test files import the real modules and
 * construct mock inputs here.
 *
 * Example:
 *   import { MockMonitor, MockWindow, MockSettings } from './mocks.js';
 *   const mon = new MockMonitor(0, 0, 1920, 1080);
 */

export class MockMonitor {
    constructor(index, x, y, width, height, primary = false) {
        this.index = index;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.primary = primary;
    }
}

export class MockWindow {
    constructor(id, title, x, y, width, height, monitorIndex = 0, minimized = false) {
        this.id = id;
        this.title = title;
        this._x = x;
        this._y = y;
        this._width = width;
        this._height = height;
        this.monitorIndex = monitorIndex;
        this.minimized = minimized;
        this._dtpPosition = undefined;
        this.clone = { x, y, width, height };
        this[Symbol.for('paperwm.float')] = false;
    }
    get_frame_rect() {
        return { x: this._x, y: this._y, width: this._width, height: this._height };
    }
    get_buffer_rect() {
        return { x: this._x, y: this._y, width: this._width, height: this._height };
    }
    get_compositor_private() {
        return this.clone;
    }
    get_monitor() {
        return this.monitorIndex;
    }
    get_stable_sequence() {
        return this.id;
    }
    get_id() {
        return this.id;
    }
    is_on_all_workspaces() {
        return false;
    }
    move_to_monitor(idx) {
        this.monitorIndex = idx;
        return true;
    }
    move_resize_frame(animate, x, y, w, h) {
        this._x = x;
        this._y = y;
        this._width = w;
        this._height = h;
    }
    move_frame(animate, x, y) {
        this._x = x;
        this._y = y;
    }
    make_above() { /* noop */ }
    unmake_above() { /* noop */ }
    stick() { /* noop */ }
    unstick() { /* noop */ }
    get_workspace() {
        return { index: () => 0 };
    }
    get_monitor_for_rect() { return this.monitorIndex; }
}

export class MockSpace {
    constructor(index, monitor, windows = [], floating = [], positionMode = null, focusMode = 0) {
        this.index = index;
        this.monitor = monitor;
        this._windows = windows;
        this._floating = floating;
        this.positionMode = positionMode;
        this.focusMode = focusMode;
        this.selectedWindow = windows[0] || null;
        this.active = true;
        this.actor = { x: 0, y: 0, remove_all_transitions: () => {}, get_transition: () => null };
        this.clip = { get_parent: () => null };
        this.workspace = { index: () => index };
        this.focusModeIcon = { setMode: () => {} };
        this.hasTopBar = false;
    }
    getWindows() {
        return this._windows;
    }
    indexOf(w) {
        return this._windows.indexOf(w);
    }
    removeWindow(w) {
        const i = this._windows.indexOf(w);
        if (i !== -1) { this._windows.splice(i, 1); return true; }
        return false;
    }
    removeFloating(w) {
        const i = this._floating.indexOf(w);
        if (i !== -1) { this._floating.splice(i, 1); return true; }
        return false;
    }
    layout() { /* noop */ }
    visibleX(w) {
        return this._windows.indexOf(w) * 200;
    }
    setMonitor() { /* noop */ }
    show() { /* noop */ }
    startAnimate() { /* noop */ }
    setSpaceTopbarElementsVisible() { /* noop */ }
}

export class MockSpaces extends Map {
    constructor(spaces = []) {
        super();
        this.activeSpace = spaces[0] || null;
        this.selectedSpace = spaces[0] || null;
        this.spanAllMonitors = true;
        for (const s of spaces) this.set(s.index, s);
    }
    get activeSpace() { return this._activeSpace; }
    set activeSpace(v) { this._activeSpace = v; }
    get selectedSpace() { return this._selectedSpace; }
    set selectedSpace(v) { this._selectedSpace = v; }
    spaceOfWindow(w) {
        for (const [, s] of this) {
            if (s.indexOf(w) !== -1) return s;
        }
        return null;
    }
    _getOrderedSpaces() {
        return [...this.values()];
    }
    _getOrderedSpacesFromAllMonitors() {
        return [...this.values()];
    }
    switchDown() { return false; }
    switchUp() { return false; }
}

export class MockSettings {
    constructor(prefs = {}) {
        this.prefs = {
            horizontal_margin: 8,
            vertical_margin: 0,
            vertical_margin_bottom: 0,
            window_gap: 10,
            minimum_margin: 10,
            animation_time: 0.1,
            cycle_width_steps: [0.5, 1, 1.5],
            cycle_height_steps: [0.5, 1, 1.5],
            sync_taskbar_order: false,
            focus_mode_enabled: true,
            default_focus_mode: 0,
            open_window_position: 0,
            ...prefs,
        };
    }
}

/**
 * Build a minimal `global`-like object for tests that need to stub
 * Main.layoutManager etc. Returns an object you can assign to `global`
 * in a test bootstrap (only meaningful inside a real GJS session).
 */
export function makeGlobalMock(monitors, primaryIndex = 0) {
    const monObjs = monitors.map((m, i) => new MockMonitor(i, m.x, m.y, m.w, m.h, i === primaryIndex));
    const layoutManager = {
        monitors: monObjs,
        primaryMonitor: monObjs[primaryIndex] || null,
        getWorkAreaForMonitor(idx) {
            const m = monObjs[idx];
            if (!m) return null;
            return { x: m.x, y: m.y, width: m.width, height: m.height };
        },
    };
    return {
        layoutManager: layoutManager,
        display: { focus_window: null, get_tab_list: () => [] },
        stage: { add_child: () => {}, remove_child: () => {}, get_children: () => [] },
        workspace_manager: {},
        get_pointer: () => [0, 0, 0],
        backend: { get_monitor_manager: () => ({}) },
        compositor: { get_laters: () => ({ add: () => {} }) },
    };
}
