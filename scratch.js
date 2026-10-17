import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as WindowMenu from 'resource:///org/gnome/shell/ui/windowMenu.js';

import { Settings, Utils, Tiling, Topbar } from './imports.js';
import { Easer } from './utils.js';

let originalBuildMenu;
let float, scratchFrame; // symbols used for expando properties on metawindow
export function enable() {
    originalBuildMenu = WindowMenu.WindowMenu.prototype._buildMenu;
    float = Symbol();
    scratchFrame = Symbol();
    WindowMenu.WindowMenu.prototype._buildMenu =
        function (window) {
            let item;
            item = this.addAction(_('Scratch'), () => {
                toggle(window);
            });
            if (isScratchWindow(window))
                item.setOrnament(PopupMenu.Ornament.CHECK);

            originalBuildMenu.call(this, window);
        };
}

export function disable() {
    WindowMenu.WindowMenu.prototype._buildMenu = originalBuildMenu;
    originalBuildMenu = null;
    float = null;
    scratchFrame = null;
}

/**
   Tween window to "frame-coordinate" (targetX, targetY).
   The frame is moved once the tween is done.

   The actual window actor (not clone) is tweened to ensure it's on top of the
   other windows/clones (clones if the space animates)
 */
export function easeScratch(metaWindow, targetX, targetY, params = {}) {
    const complete = params?.onComplete ?? function() {};
    const f = metaWindow.get_frame_rect();
    const b = metaWindow.get_buffer_rect();
    const dx = f.x - b.x;
    const dy = f.y - b.y;

    Easer.addEase(metaWindow.get_compositor_private(), {
        x: targetX - dx,
        y: targetY - dy,
        time: Settings.prefs.animation_time,
        onComplete: () => {
            metaWindow.move_frame(true, targetX, targetY);
            complete();
        },
    });
}

export function makeScratch(metaWindow) {
    let fromNonScratch = !metaWindow[float];
    let fromTiling = false;
    // Relevant when called while navigating. Use the position the user actually sees.
    let windowPositionSeen;
    // Capture owning space before stick() - after stick the window is on all
    // workspaces and spaceOfWindow is no longer reliable.
    let owningSpace = null;

    if (fromNonScratch) {
        // Figure out some stuff before the window is removed from the tiling
        try {
            owningSpace = Tiling.spaces?.spaceOfWindow(metaWindow) ?? null;
        } catch (_e) {
            owningSpace = null;
        }
        fromTiling = !!owningSpace && owningSpace.indexOf(metaWindow) > -1;
        if (fromTiling) {
            try {
                windowPositionSeen = metaWindow.clone
                    .get_transformed_position()
                    .map(Math.round);
            } catch (_e) {
                windowPositionSeen = undefined;
            }
        }
    }

    metaWindow[float] = true;
    metaWindow.make_above();
    metaWindow.stick();  // NB! Historically removed the window from the tiling (synchronously)

    // stick()/unstick() do not reliably emit workspace window-removed/window-added
    // on all GNOME/Mutter versions, so the tiling can keep a stale entry (gap)
    // until the next restart. Explicitly remove the window from its space here.
    // removeWindow() is idempotent and triggers layout(), so this is a no-op if
    // the window-removed handler already ran.
    if (fromNonScratch) {
        try {
            if (owningSpace) {
                if (owningSpace.indexOf(metaWindow) !== -1) {
                    owningSpace.removeWindow(metaWindow);
                } else {
                    owningSpace.removeFloating(metaWindow);
                }
            } else if (Tiling.spaces) {
                // Fallback: window was sticky/floating or space lookup failed -
                // search all spaces so no stale clone is left behind.
                Tiling.spaces.forEach(s => {
                    if (s.indexOf(metaWindow) !== -1) {
                        s.removeWindow(metaWindow);
                    } else {
                        s.removeFloating(metaWindow);
                    }
                });
            }
        } catch (e) {
            console.warn('#PaperWM makeScratch layout refresh failed:', e?.message ?? e);
        }
    }

    // Stuck windows are in no Space: drop any taskbar-order rank so it
    // can't collide with tiled windows' ranks (Dash-to-Panel sorts by it).
    // Re-sync survivors to contiguous ranks, forcing the nudge: a
    // provisional stamp may have shifted them to make room for this window
    // (which never tiles), and a panel may have painted that provisional.
    // Both are no-ops unless sync-taskbar-order is on; never throw.
    try {
        Tiling.clearTaskbarPosition?.(metaWindow);
    } catch (_e) { /* ignore */ }
    try {
        Tiling.forceTaskbarResync?.();
    } catch (_e) { /* best-effort */ }

    if (!metaWindow.minimized) {
        try {
            Tiling.showWindow(metaWindow);
        } catch (_e) {
            console.warn('#PaperWM makeScratch showWindow failed:', _e?.message ?? _e);
        }
    }

    // NOTE: no synchronous raise()/activate here. makeScratch() runs on the
    // `first-frame` stack for new windows (via insertWindow) and shows the
    // actor synchronously, so raising/activating now re-enters Mutter while
    // the window is still being mapped - fatal for launcher overlays like
    // Vicinae (session crash -> logout). make_above() above already puts the
    // window in the always-on-top layer; focus is deferred to IDLE with
    // liveness guards by activateWindowAfterRendered in tiling.js.
    // Activation raises within the above layer by itself.

    if (fromTiling) {
        try {
            let f = metaWindow.get_frame_rect();
            let targetFrame = null;

            if (metaWindow[scratchFrame]) {
                let sf = metaWindow[scratchFrame];
                if (Utils.monitorOfPoint(sf.x, sf.y) === Tiling.focusMonitor()) {
                    targetFrame = sf;
                }
            }

            if (!targetFrame) {
                // Default to moving the window slightly down and reducing the height
                let vDisplacement = 30;
                let [x, y] = windowPositionSeen;  // The window could be non-placable so can't use frame

                targetFrame = new Mtk.Rectangle({
                    x, y: y + vDisplacement,
                    width: f.width,
                    height: Math.min(f.height - vDisplacement, Math.floor(f.height * 0.9)),
                });
            }

            if (!metaWindow.minimized) {
                metaWindow.move_resize_frame(true, f.x, f.y,
                    targetFrame.width, targetFrame.height);
                easeScratch(
                    metaWindow,
                    targetFrame.x,
                    targetFrame.y,
                    {
                        onComplete: () => {
                            delete metaWindow[scratchFrame];
                            Main.activateWindow(metaWindow);
                        },
                    });
            } else {
                // Can't restore the scratch geometry immediately since it distort the minimize animation
                // ASSUMPTION: minimize animation is not disabled and not already done
                let actor = metaWindow.get_compositor_private();
                let signal = actor.connect('effects-completed', () => {
                    metaWindow.move_resize_frame(true, targetFrame.x, targetFrame.y,
                        targetFrame.width, targetFrame.height);
                    actor.disconnect(signal);
                });
            }
        } catch (_e) {
            console.warn('#PaperWM makeScratch fromTiling layout failed:', _e?.message ?? _e);
        }
    }

    try {
        Tiling.focusMonitor()?.clickOverlay?.hide();
    } catch (_e) { /* ignore */ }
}

export function unmakeScratch(metaWindow) {
    if (!metaWindow[scratchFrame])
        metaWindow[scratchFrame] = metaWindow.get_frame_rect();
    metaWindow[float] = false;
    metaWindow.unmake_above();
    metaWindow.unstick();

    // unstick() does not reliably emit workspace window-added on all
    // GNOME/Mutter versions, so the window can stay untiled (invisible in the
    // layout) until the next restart. Explicitly re-insert it into the tiling.
    // insertWindow() is idempotent (early-returns if already tiled), so this is
    // a no-op if the window-added handler already ran.
    // Minimized windows stay out of the tiling until unminimize (handled via
    // minimizeHandler), so skip re-insert while minimized.
    if (!metaWindow.minimized) {
        try {
            Tiling.insertWindow(metaWindow, { existing: true });
        } catch (e) {
            console.warn('#PaperWM unmakeScratch layout refresh failed:', e?.message ?? e);
        }
    }
}

export function toggle(metaWindow) {
    try {
        if (isScratchWindow(metaWindow)) {
            unmakeScratch(metaWindow);
        } else {
            makeScratch(metaWindow);

            if (metaWindow.has_focus) {
                let space = Tiling.spaces.activeSpace;
                space?.setSelectionInactive?.();
            }
        }
    } catch (_e) { /* ignore */ }
}

export function isScratchWindow(metaWindow) {
    return metaWindow && metaWindow[float];
}

/** Return scratch windows in MRU order */
export function getScratchWindows() {
    return global.display.get_tab_list(Meta.TabList.NORMAL, null)
        .filter(isScratchWindow);
}

export function isScratchActive() {
    return getScratchWindows().some(metaWindow => !metaWindow.minimized);
}

export function toggleScratch() {
    try {
        if (isScratchActive())
            hide();
        else
            show();
    } catch (_e) { /* ignore */ }
}

export function toggleScratchWindow() {
    try {
        let focus = global.display.focus_window;
        if (isScratchWindow(focus))
            hide();
        else
            show(true);
    } catch (_e) { /* ignore */ }
}

export function show(top) {
    let windows;
    try {
        windows = getScratchWindows();
    } catch (_e) {
        return;
    }
    if (windows.length === 0) {
        return;
    }
    if (top)
        windows = windows.slice(0, 1);

    try {
        Topbar.fixTopBar();
    } catch (_e) { /* ignore - topbar best-effort */ }

    // Reveal each scratch window independently: one failing window must not
    // abort the rest (robust against a dead/disposed actor).
    windows.slice().reverse().forEach(function(meta_window) {
        try {
            meta_window.unminimize();
            meta_window.make_above();
            meta_window.get_compositor_private().show();
        } catch (_e) {
            console.warn('#PaperWM show scratch window failed:', _e?.message ?? _e);
        }
    });

    try {
        windows[0].activate(global.get_current_time());
    } catch (_e) { /* ignore */ }

    try {
        let monitor = Tiling.focusMonitor();
        monitor.clickOverlay?.hide();
    } catch (_e) { /* ignore */ }
}

export function hide() {
    let windows;
    try {
        windows = getScratchWindows();
    } catch (_e) {
        return;
    }
    windows.forEach(function(meta_window) {
        try {
            meta_window.minimize();
        } catch (_e) { /* ignore dead window */ }
    });
}

export function animateWindows() {
    let ws;
    try {
        ws = getScratchWindows().filter(w => !w.minimized);
        ws = global.display.sort_windows_by_stacking(ws);
    } catch (_e) {
        return;
    }
    for (let w of ws) {
        try {
            if (!w.clone)
                continue;
            Utils.actor_remove_parent(w.clone);
            Main.uiGroup.insert_child_above(w.clone, global.window_group);
            let f = w.get_frame_rect();
            w.clone.set_position(f.x, f.y);
            Tiling.animateWindow(w);
        } catch (_e) {
            console.warn('#PaperWM animate scratch window failed:', _e?.message ?? _e);
        }
    }
}

export function showWindows() {
    let ws;
    try {
        ws = getScratchWindows().filter(w => !w.minimized);
    } catch (_e) {
        return;
    }
    ws.forEach(function(w) {
        try {
            Tiling.showWindow(w);
        } catch (_e) { /* ignore */ }
    });
}
