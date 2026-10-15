# paperwm-mod — Branch Changes

**Branch:** `durjan/paperwm-mod` (HEAD `940b2da`)
**Base:** `origin/release` / `release` at `8bf6dd2` (“Update README.md”)
**Date covered:** 2026-10-01 → 2026-10-14
**Range command:** `git log 8bf6dd2..HEAD --reverse --stat` / `git diff 8bf6dd2..HEAD --stat`
**Commits on branch:** 14 (all by `durjan`)
**Diff size:** `15 files changed, 1402 insertions(+), 150 deletions(-)` (plus `gschemas.compiled` regen)

> This file is the branch changelog. Upstream user docs remain in `README.md`.
> Security review is in `SECURITY_AUDIT.md`.

## Commit list (oldest → newest)

| # | Hash | Date | Subject |
|---|------|------|---------|
| 1 | `fa9628e` | 2026-10-01 | Rename extension to paperwm-mod and add span-all-monitors mode |
| 2 | `f9bd983` | 2026-10-01 | Force fullscreen windows to primary monitor in span mode |
| 3 | `b9436fc` | 2026-10-01 | Fix focus EDGE mode to snap to primary monitor edges in span mode |
| 4 | `4a8943c` | 2026-10-01 | Fix drifting viewport snap-back and blank overscroll |
| 5 | `6b44a41` | 2026-10-01 | Cycle window through primary then span left-center-right on focus-mode key |
| 6 | `8112598` | 2026-10-01 | Add security audit for paperwm-mod |
| 7 | `65854ce` | 2026-10-01 | Fix position cycle reliability and restore focus-mode setting text |
| 8 | `f8df607` | 2026-10-01 | Fix drifting viewport in span mode and release cycle lock on manual pan |
| 9 | `4476975` | 2026-10-06 | Auto-center focused windows from startup without shortcut |
| 10 | `83e5f75` | 2026-10-12 | Add sync-taskbar-order setting to mirror tiling order in Dash-to-Panel |
| 11 | `85b547f` | 2026-10-12 | Wrap all-monitors workspace switch and move-window up/down around ends |
| 12 | `522882c` | 2026-10-12 | Fix scratch layer layout refresh on add/remove |
| 13 | `3820d9a` | 2026-10-14 | Sync taskbar order early and nudge Dash-to-Panel to re-sort |
| 14 | `940b2da` | 2026-10-14 | Fix drift-left direction and harden drift against stuck flag |

Per-commit `--stat` summary:

- `fa9628e`: `Makefile, metadata.json, patches.js, stackoverlay.js, tiling.js` (+522/−99)
- `f9bd983`: `keybindings.js, tiling.js` (+66/−8)
- `b9436fc`: `tiling.js` (+44/−10)
- `4a8943c`: `navigator.js, tiling.js` (+96/−9)
- `6b44a41`: `gschema.xml, tiling.js` (+157/−10)
- `8112598`: `SECURITY_AUDIT.md` (+73)
- `65854ce`: `gschema.xml, tiling.js` (+87/−51)
- `f8df607`: `gestures.js, tiling.js` (+41/−6)
- `4476975`: `gschema.xml, gschemas.compiled, tiling.js` (+27/−8)
- `83e5f75`: `Settings.ui, prefs.js, gschema.xml, gschemas.compiled, settings.js, tiling.js` (+133)
- `85b547f`: `keybindings.js, tiling.js` (+26/−14)
- `522882c`: `scratch.js` (+54/−3)
- `3820d9a`: `tiling.js` (+108)
- `940b2da`: `tiling.js` (+90/−54)

## Files touched (vs base)

```text
Makefile
metadata.json
SECURITY_AUDIT.md            (new)
Settings.ui
gestures.js
keybindings.js
navigator.js
patches.js
prefs.js
schemas/gschemas.compiled
schemas/org.gnome.shell.extensions.paperwm.gschema.xml
scratch.js
settings.js
stackoverlay.js
tiling.js                    (+1248/−~150, bulk of branch)
```

## 1) Rename: `paperwm` → `paperwm-mod` (`fa9628e`)

Installable side-by-side with upstream; no behavior change by itself.

- `Makefile:8`: `EXT_ID := paperwm-mod@paperwm.github.com`
- `metadata.json:2-3`: `uuid: paperwm-mod@paperwm.github.com`, `name: PaperWM (Mod)`
- Install path becomes `~/.local/share/gnome-shell/extensions/paperwm-mod@paperwm.github.com`

## 2) Span-all-monitors mode — core feature (`fa9628e` + follow-ups)

One PaperWM `Space` spans all monitors instead of one `Space` per monitor.
Kill-switch in `tiling.js:52`:

```js
export const SPAN_ALL_MONITORS = true; // set false to revert to upstream layout
```

New helpers (`tiling.js:53-160`):

- `getMonitorsBoundingBox()` — union rect of all `Main.layoutManager.monitors`.
- `computeSpannedWorkArea()` — union of all monitor work-areas in span/space coords (applies `vertical_margin` / `vertical_margin_bottom`).
- `getPrimaryWorkAreaSpanCoords()` — primary monitor work-area in span coords; used for centering/focus so windows land on primary, not on the bezel.
- `moveWindowToPrimaryMonitor(metaWindow)` — `move_to_monitor(primary.index)` if needed; used by fullscreen paths.

Span-aware rework throughout `tiling.js`:

- `Spaces`: `this.spanAllMonitors = SPAN_ALL_MONITORS` (`tiling.js:2651`); single-space init/switch/monitor-update paths guarded (only `minimum` workspaces needed, not one per monitor).
- `Space.workArea()` (`tiling.js:688`): returns spanned union in span mode.
- `Space.layout()`, `addWindow`, `isPlaceable`, `showWindow`, `takeWindow`, `centerWindow`, `ensuredX`/`ensureViewport`, grab Y origins, clone-container centering: all branch on `spaces?.spanAllMonitors` and use bounding-box origin (`bb.x/bb.y`) instead of `space.monitor.x/y`.
- Fullscreen/maximized placement uses primary-monitor origin, not bounding-box origin (which is the secondary monitor when it sits left/above primary).
- `stackoverlay.js:60` (`multimonitorSupport`): per-monitor `clickOverlay` activation disabled in span mode.
- `patches.js`: span-aware `_isMyWindow` (Workspace + WorkspaceThumbnail return `onSpace` only, skipping per-monitor check); `_checkWorkspaces` minimum becomes `2:1` (dynamic:static) in span mode instead of `nMon+1 : nMon`; overview/workspace-switch overrides made null-safe (`spaces?.`, try/catch fall back to upstream) so a missing `Space` never breaks overview rendering.
- `focus_handler` (`tiling.js:5249`): no pointer-warp between monitors in span mode (same Space covers all outputs).

## 3) Fullscreen always on primary (`f9bd983`)

- `tiling.js:138` `moveWindowToPrimaryMonitor()` + call in `keybindings.js:344` (`paper-toggle-fullscreen`, Super+Shift+F) before `make_fullscreen()`.
- Native F11 path covered where tiled windows enter fullscreen during layout/focus.
- `ensuredX` fullscreen branch (`tiling.js:4910`): `x = getPrimaryWorkAreaSpanCoords().x` in span mode.

## 4) Focus CENTER / EDGE made primary-aware (`b9436fc`, `6b44a41`, `65854ce`)

Upstream `CENTER` centered on whole work-area (= bezel in span mode) and `EDGE` snapped to span edges (= secondary monitors). Now both use primary:

- `ensuredX` (`tiling.js:4900-4957`): `CENTER` → primary center; `EDGE` → `edgeMin/edgeMax` from `primaryWA`; single-window `EDGE` centers on primary.
- `setFocusMode` (`tiling.js:5892`): midpoint/edges/unfocus restore computed from `primaryWA` in span mode, with margin-adjusted primary-edge positions for `DEFAULT` restore.
- `centerWindow` (`tiling.js:5713`): centers on `getPrimaryWorkAreaSpanCoords()` in span mode (scratch path converts span→stage coords via bounding-box origin).
- `Space.layout` single-column centering and `addWindow` centering use primary area in span mode.

## 5) Focus-mode key repurposed: manual left/center/right cycle (`6b44a41`, `65854ce`, `f8df607`)

Legacy space-wide `DEFAULT → CENTER → EDGE` rotation replaced by a sticky per-space position cycle on the primary monitor.

- State: `Space.positionMode: null | 0 | 1 | 2` (`tiling.js:416`; `null` = legacy `focusMode` applies; `0` = primary-left, `1` = primary-center, `2` = primary-right). Shared by whole space so `w1/w2/w3` follow one sequence (per-window derivation diverged because all share one viewport offset).
- `switchToNextFocusMode()` (`tiling.js:5989`) now calls `cycleWindowPositionDirection(metaWindow, space, 1)`; accepts `(space)`, `()`, `(metaWindow, space)` conventions.
- `cycleWindowPositionDirection` (`tiling.js:5793`): resolves `metaWindow`’s *own* space (`spaceOfWindow`, not stale `selectedSpace`), drops legacy `CENTER/EDGE` to `DEFAULT` (icons updated, no move) so cycled position sticks, first press starts from step *after* closest target (avoids no-op), then `(mode+dir)%3`; tiled → `move_to(space, w, {x: targets[mode]})`, floating/scratch → `Scratch.easeScratch`.
- `getWindowPositionTargets` (`tiling.js:5747`): `[primary.x+margin, primary-center, primary.right-margin-fw]` in span mode, else work-area equivalents.
- `ensuredX` `positionMode` branch (`tiling.js:4917`): every focused window goes to the same primary slot while a cycle is active.
- `setFocusMode` clears `positionMode`; `Space.init` from saved/restored spaces preserves `positionMode` across restores and snaps (`ensureViewport(force:true)`) so restore doesn’t stay left-aligned.
- `Space.layout(centerIfOne)` (`tiling.js:1005`) skips single-column auto-center while `positionMode` active (it already snapped).
- Setting text restored: `default-focus-mode` summary no longer advertises the cycle (see §7).

## 6) Drift (free pan with Super+arrows / liveAltTab) fixes (`4a8943c`, `f8df607`, `940b2da`)

`Space._drift(dx)` (`tiling.js:1518`) + `driftLeft/driftRight` (`tiling.js:1692`):

- Direction bug (`940b2da`): `findTargetWindow(space, right)` expects boolean; passing `-1` was truthy → drift-left searched rightward. Now `const right = dx > 0`.
- Stuck-flag hardening (`940b2da`): `driftTimeout` is global single-shot; a leaked `drifting=true` with no active timeout (tick threw, space switched, timeout stolen) permanently killed drift. Now self-heals (`if (!driftTimeout) clear flag`) and clears a stale flag on the *other* space (`driftSpace` tracking, `tiling.js:213,355`).
- Snap-back fix (`4a8943c`): each tick started an `ensureViewport` animation that pulled the viewport back on key release. Now `Easer.removeEase(cloneContainer)` before direct panning, free-pan clamps to tiled content (never narrower than viewport), and on release snaps to nearest window instead of resting in blank space.
- Release ordering (`4a8943c`): `navigator.js:198` runs `keyReleaseCallbacks` (drift snap) *before* `_finish`/dismiss so the drifted position is accepted, not the pre-drift one. Navigator-destroy path also stops the timeout; snaps only if navigation was accepted, otherwise lets navigator restore.
- Cycle-lock release (`f8df607`): drift clears `space.positionMode` (otherwise release snap pulled back to cycled slot); manual touchpan also clears it — `gestures.js:339` (`update(space,dx,t)`: `space.positionMode = null`) with comment. Errors in drift tick/snap log and stop drift instead of wedging the keyboard grab.

## 7) Default focus mode + auto-center from startup (`4476975`, `65854ce`)

- `schemas/...gschema.xml`: `default-focus-mode` default `0 → 1` (DEFAULT → CENTER), so new `Space`s start centered.
- `Space` constructor (`tiling.js:403`) inits `focusMode` from `getDefaultFocusMode()` (try/catch fallback to DEFAULT if Settings not ready).
- Startup (`tiling.js:286`): spaces needing center (`CENTER` or active `positionMode`) snap with `{force:true}` even when already fully visible (previously `{moveto:false}` left them left-aligned until next focus/shortcut). Same snap after state restore (`tiling.js:563`).
- `65854ce` also fixes cycle reliability (own-space resolution above) and restores the stock `default-focus-mode` summary text.

## 8) Scratch layer layout refresh (`522882c`, `scratch.js:64-195`)

`stick()/unstick()` don’t reliably emit workspace `window-removed/added` on all Mutter versions → stale tiling entries (gaps) or untiled-but-visible windows until restart.

- `makeScratch`: captures `owningSpace` *before* `stick()` (after stick `spaceOfWindow` is unreliable), then explicitly `removeWindow`/`removeFloating` (idempotent, triggers `layout()`); fallback sweeps all spaces if lookup failed.
- `unmakeScratch`: after `unstick()`, explicitly `Tiling.insertWindow(w, {existing:true})` (idempotent) unless minimized (minimized path handled via `minimizeHandler` on unminimize).
- Failures warn (`#PaperWM ... layout refresh failed`) instead of throwing.

## 9) Sync taskbar order → Dash-to-Panel (`83e5f75`, `3820d9a`)

Mirrors PaperWM left-to-right order into Dash-to-Panel ungrouped icons/previews, which natively sort by `get_stable_sequence()` (creation order). Uses DTP’s `window._dtpPosition` override (set by manual icon drags).

- New setting `sync-taskbar-order` (bool, default `false`): `gschema.xml`, `settings.js:65`, `prefs.js:479` (`booleanStateChanged`), `Settings.ui:2184` switch (“Sync window order to taskbar (e.g. Dash-to-Panel ungrouped)”), live toggle handler in `tiling.js:265` (on → `syncTaskbarOrder()`, off → `clearTaskbarOrder()`).
- `syncTaskbarOrder()` (`tiling.js:6435`): no-op unless setting on; stamps `w._dtpPosition = pos++` in workspace-index order, tiled then `_floating` per space; then `nudgeTaskbarOrder(signature)`.
- `stampProvisionalTaskbarPosition()` (`tiling.js:6475`): stamps predicted rank on `window-created` using same `getOpenWindowPositionIndex()` as `insertWindow`, because DTP’s deferred `_redisplay` (on `window-added`) fires before first-frame placement; `syncTaskbarOrder()` corrects after.
- `nudgeTaskbarOrder()` (`tiling.js:6547`): emits `AppFavorites.getAppFavorites().emit('changed')` (needs `import * as AppFavorites`, `tiling.js:10`) to reach DTP’s `_queueRedisplay`; signature-gated so only real order changes nudge (never per-layout noise).
- Call sites: `Space.layout()`, `addFloating`/`removeFloating`, enable-continuation, `gsettings` toggle; `clearTaskbarOrder()` deletes overrides on disable/setting-off (restores native creation-order sort); `clearTaskbarPosition()` on `insertWindow` sticky returns and `makeScratch()` (see above).
- Follow-up `3820d9a` adds the early/provisional stamping + nudge (prior revision only synced late, so new windows painted in creation order and never re-sorted).
- Required Dash-to-Panel configuration (diagnosed with temporary instrumented logging against DTP v74 source): `getAppInfos()` merged path (`allowSplitApps=false`, i.e. `group-apps=false` + favorites shown + `group-apps-use-launchers=false`) orders app blocks favorites-first with same-app windows contiguous, so stamps can only order *within* each app. True PaperWM order needs the split path: `group-apps-use-launchers=true` (or `show-favorites=false`) — favorites become separate launchers and all running windows form one globally-sorted strip driven by `_dtpPosition`. Required dconf settings (DTP applies them live, no relogin):
  ```bash
  dconf write /org/gnome/shell/extensions/paperwm/sync-taskbar-order true
  dconf write /org/gnome/shell/extensions/dash-to-panel/group-apps-use-launchers true
  ```
  Verify with `dconf read …` (must print `true`); `group-apps=false` selects ungrouped icons and `isolate-workspaces`/`isolate-monitors` may stay either way (ranks are globally unique).
- Stale-rank cleanup: `clearTaskbarPosition(metaWindow)` (`tiling.js`) drops the rank on never-tiled paths (`insertWindow` sticky/scratch early returns) and in `scratch.js makeScratch()` (stuck windows are in no `Space`). Observed cause: launcher overlays (e.g. Vicinae) kept provisional ranks colliding with tiled windows' ranks.
- `83e5f75` also regens `schemas/gschemas.compiled` (12333 → 12389 bytes).

## 10) Workspace switch / move-window wrap (`85b547f`)

- `tiling.js:6224`: `selectDownSpace/selectUpSpace(mw, space, fromAllMonitors, wrap=false)` and `moveDownSpace/moveUpSpace(..., wrap=false)` thread `wrap` into `selectSequenceSpace`.
- `keybindings.js:166-171`: `switch-*-workspace-from-all-monitors` now passes `wrap=true`; plain `move-*-workspace` now calls `(mw, space) => move*(mw, space, true)` (previously unwrapped `Tiling.moveDownSpace` ref). Up/down now wraps around ends instead of sticking.

## 11) Misc hardening

- `patches.js` (`fa9628e`): null-safe `Tiling.spaces?.spaceOfIndex/forEach/selectedSpace?.monitor` with `primaryMonitor` fallback in Alt-Tab clone sizing; `_isMyWindow` try/catch fallback to saved prototype; `_checkWorkspaces` span-aware minimums.
- `gestures.js:339` (`f8df607`): manual pan clears `positionMode` (see §6).
- `navigator.js:198` (`4a8943c`): release-callback ordering (see §6).
- `keybindings.js:344` (`f9bd983`): fullscreen → primary first (see §3).
- `SECURITY_AUDIT.md` (`8112598`): read-only audit of tree at `fa9628e+f9bd983` — verdict no malware/backdoor/exfiltration; documents spawn/network/clipboard hits as legitimate, `flake.lock` pins, `gschemas.compiled` magic, test-only creds in `vm.nix`; recommends re-running `git diff release..HEAD --stat` + pattern grep before upstream merges. (Audit’s “only 2 commits” scope note is stale — branch now has 14.)

## 12) Settings / schema changes

| Key | Type | Default (old → new) | UI |
|-----|------|---------------------|----|
| `default-focus-mode` | `i` | `0 → 1` (DEFAULT → CENTER) | existing “Default focus mode” row |
| `sync-taskbar-order` | `b` (new) | `false` | new `Settings.ui` switch + `prefs.js` binding |

After editing `gschema.xml`, `schemas/gschemas.compiled` must be regenerated (`glib-compile-schemas schemas/`); commits `4476975`/`83e5f75` include the binary.

## Kill-switches & rollback

- Span mode: `tiling.js:52` `SPAN_ALL_MONITORS = true → false` restores upstream per-monitor Spaces without reverting other fixes (overview/patches guards are span-conditional).
- Taskbar sync: `sync-taskbar-order = false` (default) or `clearTaskbarOrder()` on disable — zero effect without a compatible taskbar (only a cheap GNOME Dash refresh via `AppFavorites.changed`).
- Focus behavior: set `default-focus-mode = 0` to restore upstream DEFAULT; pressing the legacy focus-mode UI still calls `setFocusMode` (clears `positionMode`).
- Wrap: callers in `keybindings.js` pass `wrap=true`; change to `false`/omit to restore clamping.

## Verification (reproduce this doc)

```bash
git log --oneline 8bf6dd2..HEAD --reverse
git diff 8bf6dd2..HEAD --stat
git diff 8bf6dd2..HEAD -- tiling.js | grep -E "SPAN_ALL|positionMode|_dtpPosition|driftSpace|wrap"
glib-compile-schemas --dry-run schemas/  # schema sanity
make install  # installs as paperwm-mod@paperwm.github.com; logout/login or Alt-F2 r (X11)
```

Manual checks: 2-monitor span (one Space across both, centering/focus/fullscreen on primary); focus-key cycles primary left→center→right; Super+arrows drift pans then snaps to a window (left and right); scratch attach/detach leaves no gap/ghost; DTP ungrouped order follows tiling left-to-right when setting on, creation order when off; all-monitors ws switch and move-window wrap at ends.
