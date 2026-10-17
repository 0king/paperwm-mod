# paperwm-mod — Branch Changes

**Branch:** `durjan/paperwm-mod` (HEAD `eeba63d`)
**Base:** `origin/release` / `release` at `8bf6dd2` (“Update README.md”)
**Date covered:** 2026-10-01 → 2026-10-17
**Range command:** `git log 8bf6dd2..HEAD --reverse --stat` / `git diff 8bf6dd2..HEAD --stat`
**Commits on branch:** 38 (all by `durjan`)
**Diff size:** `33 files changed, 5555 insertions(+), 250 deletions(-)` (plus `gschemas.compiled` regen)

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

### Follow-up commits (`940b2da` → `eeba63d`)

| # | Hash | Date | Subject |
|---|------|------|---------|
| 15 | `29bf583` | 2026-10-14 | Suspend center-on-focus while drifting, restore on center-window shortcut |
| 16 | `05424d8` | 2026-10-14 | Add branch changelog for paperwm-mod |
| 17 | `466be3b` | 2026-10-14 | Add AGENTS.md agent guide for paperwm-mod |
| 18 | `53bc6da` | 2026-10-15 | Clear stale taskbar ranks and document Dash-to-Panel split-mode requirement |
| 19 | `9adb018` | 2026-10-15 | Document required dconf settings for taskbar order sync |
| 20 | `04fccf1` | 2026-10-15 | Fix new scratch window focus when always-on-top window is active |
| 21 | `7aadad0` | 2026-10-15 | Add export/import of user settings to About tab |
| 22 | `b71c4a6` | 2026-10-15 | Add focus-mode-enabled setting to disable focus auto-centering |
| 23 | `c4aab44` | 2026-10-16 | Fix session crash when opening scratch-layer launchers (e.g. Vicinae) |
| 24 | `69b5110` | 2026-10-16 | Harden taskbar order sync against stale ranks and missed nudges |
| 25 | `ab48d52` | 2026-10-16 | Fix settings export/import: file picker path, timestamped .md, robust errors |
| 26 | `c3512a3` | 2026-10-16 | Force taskbar re-sync after startup burst settles |
| 27 | `232170c` | 2026-10-17 | Harden scratch layer visibility against throwing sub-steps |
| 28 | `72986a8` | 2026-10-17 | add bugs.md |
| 29 | `8363b56` | 2026-10-17 | add tests/ (suite scaffolding + span/focus/wrap/scratch/navigator tests) |
| 30 | `edc925d` | 2026-10-17 | update agents.md |
| 31 | `0ed779f` | 2026-10-17 | update gitignore |
| 32 | `abbe7b3` | 2026-10-17 | update makefile |
| 33 | `bbba2e8` | 2026-10-17 | agents.md: instruction update |
| 34 | `e166759` | 2026-10-17 | agents.md: instruction update |
| 35 | `602a0b9` | 2026-10-17 | fix: make taskbar sync async with debouncing to handle startup window bursts (reverted) |
| 36 | `b198827` | 2026-10-17 | agents.md: instruction update |
| 37 | `90fcd31` | 2026-10-17 | Revert `602a0b9` (botched; stray tokens broke `tiling.js`) |
| 38 | `eeba63d` | 2026-10-17 | fix: move taskbar sync off the main thread into a debounced scheduler |

Per-commit `--stat` (follow-up range):

- `29bf583`: `keybindings.js, tiling.js` (+69/−1)
- `05424d8`: `CHANGES-paperwm-mod.md` (new, +207)
- `466be3b`: `AGENTS.md` (new, +45)
- `53bc6da`: `README.md, CHANGES-paperwm-mod.md, scratch.js, tiling.js` (+24/−2)
- `9adb018`: `README.md, CHANGES-paperwm-mod.md` (+8/−2)
- `04fccf1`: `scratch.js, tiling.js` (+23/−1)
- `7aadad0`: `Settings.ui, prefs.js` (+288)
- `b71c4a6`: `CHANGES-paperwm-mod.md, Settings.ui, keybindings.js, prefs.js, prefsKeybinding.js, gschemas.compiled, gschema.xml, settings.js, tiling.js` (+198/−17)
- `c4aab44`: `scratch.js, tiling.js` (+83/−21)
- `69b5110`: `scratch.js, tiling.js` (+265/−22)
- `ab48d52`: `prefs.js` (+228/−56)
- `c3512a3`: `scratch.js, tiling.js` (+53/−8)
- `232170c`: `scratch.js` (+147/−85)
- `72986a8`: `bugs/bugs.md` (new, +13)
- `8363b56`: `tests/` (10 files, +1201)
- `edc925d`: `AGENTS.md` (+22/−1)
- `0ed779f`: `.gitignore` (+2)
- `abbe7b3`: `Makefile` (+8/−1)
- `bbba2e8`, `e166759`, `b198827`: `AGENTS.md` (instructions)
- `602a0b9`: `tiling.js` (+117/−64, reverted)
- `90fcd31`: `tiling.js` (−117/+64, revert)
- `eeba63d`: `taskbar.js` (new), `tests/taskbar.test.js` (new), `tiling.js`, `tests/tiling-taskbar.test.js`, `tests/run.js` (+1834/−456)

Behavioral follow-ups after `940b2da` — beyond the taskbar rework in §14 — are:
the drift/focus interaction (`29bf583`), taskbar hardening (`53bc6da`,
`69b5110`, `c3512a3`; reworked into `taskbar.js` by §14), scratch focus/crash/
visibility fixes (`04fccf1`, `c4aab44`, `232170c`), settings export/import
(`7aadad0` + fix `ab48d52`), and the `focus-mode-enabled` kill-switch
(`b71c4a6`). `git show <hash>` remains the source of truth for their details.

## Files touched (vs base)

```text
.gitignore
AGENTS.md                    (new)
CHANGES-paperwm-mod.md       (new)
Makefile
README.md
SECURITY_AUDIT.md            (new)
Settings.ui
bugs/bugs.md                 (new)
gestures.js
keybindings.js
metadata.json
navigator.js
patches.js
prefs.js
prefsKeybinding.js
schemas/gschemas.compiled
schemas/org.gnome.shell.extensions.paperwm.gschema.xml
scratch.js
settings.js
stackoverlay.js
taskbar.js                    (new — §14 scheduler)
tests/                        (new: harness, mocks, run + 8 suites)
tiling.js                     (+1534/−~200, bulk of branch)
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

> Historical design (first revision). The synchronous stamping/nudging
> described here was replaced by the `taskbar.js` scheduler in §14
> (`eeba63d`); the setting, DTP configuration, and dconf requirements below
> still apply.

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
| `focus-mode-enabled` | `b` (new) | `true` | new “Enable window focus mode” switch + `prefs.js` binding |
| `toggle-focus-mode-enabled` (keybindings) | `as` (new) | `['<Super><Alt>c']` | keybindings prefs row (`prefsKeybinding.js`) |

After editing `gschema.xml`, `schemas/gschemas.compiled` must be regenerated (`glib-compile-schemas schemas/`); commits `4476975`/`83e5f75` include the binary.

## 13) Focus-mode enable/disable kill-switch

New `focus-mode-enabled` setting (bool, default `true` — existing installs keep current behavior). While disabled, DEFAULT behavior is forced everywhere: focusing/clicking windows never auto-centers/moves them.

- `tiling.js`: `isFocusModeEnabled()` gate; `ensuredX` skips the CENTER / `positionMode` / EDGE branches (plain DEFAULT clamping applies); `getDefaultFocusMode()` and `setFocusMode()` coerce to DEFAULT; single-window auto-center skipped in `Space.layout` (`centerIfOne`), `addWindow` pre-layout centering, and `resizeHandler`; startup and state-restore snaps skipped; new-space restores ignore saved `focusMode`/`positionMode`. Explicit one-shot centering (`center-horizontally`, Super+C) still works while disabled.
- Cycle key (`switch-focus-mode`, e.g. Super+C): pressing it while disabled re-enables focus mode and advances `positionMode` left/center/right in one press (single move — `suppressFocusModeEnabledRestore` skips the enable-restore that would otherwise center-then-cycle). Topbar/focus-icon clicks go through the same path, so they auto-enable too.
- Live toggle: `changed::focus-mode-enabled` drops all spaces to DEFAULT on disable (clears `positionMode`/`suspendedFocusMode`, syncs icons, no window move); on enable restores the default mode per space (skipped if a space already holds a cycle position from a late-delivered auto-enable).
- Toggle key: `toggle-focus-mode-enabled` (default `<Super><Alt>c` — `<Super><Shift>c` stays on the cycle action to avoid a duplicate default; rebind after moving the cycle key if desired).

## 14) Taskbar order sync — asynchronous scheduler (`eeba63d`, `taskbar.js`)

Replaces the synchronous mechanism of §9 (same setting, same DTP
configuration, same ordering rules) and closes `bugs/bugs.md` §3.2. The
problem: stamping + nudging ran inline from `Space.layout()`,
`window-created`, and floating add/remove; during the login autostart burst
the nudge could reach Dash-to-Panel before DTP finished enabling (or after it
painted an early snapshot), and the signature gate then suppressed every
later nudge because the order had not changed — icons stayed missing until
the next real order change.

- New module `taskbar.js` (`createTaskbarSync(deps)`, no `gi://` imports):
  every pass is **debounced (50 ms) and idle-deferred** — no taskbar work runs
  synchronously in a signal handler or layout pass. A window burst collapses
  into one pass; nudges remain signature-gated; `forceResync()` and the
  startup chain bypass the gate but are still scheduled.
- `tiling.js` keeps only the shell wiring (`createLiveTaskbarSync()`:
  `GLib.timeout_add`, `Utils.later_add(Meta.LaterType.IDLE)`, `AppFavorites`
  nudge, `global.get_window_actors` sweep for clears) and the historical
  exports as thin scheduled delegates: `scheduleTaskbarSync()` (new, used by
  all call sites), `syncTaskbarOrder()`, `forceTaskbarResync()`,
  `clearTaskbarPosition()`, `clearTaskbarOrder()`, plus
  `beginTaskbarStartupPhase()` / `endTaskbarStartupPhase()`.
- **Startup burst cover** (the actual §3.2 fix): `enable()` calls
  `beginTaskbarStartupPhase()` when `Main.layoutManager._startingUp`. Each
  natural pass during the phase arms a chain of forced re-asserts at
  +1 s / +3 s / +8 s (`TaskbarSyncDefaults.startupResyncDelaysMs`); chain
  steps never re-arm a chain, so each chain is bounded; the phase auto-ends
  after 30 s (`startupPhaseMs`) and performs one final forced pass — a late-
  or slow-to-enable DTP converges.
- Removed `stampProvisionalTaskbarPosition()` and all synchronous stamping
  from `display::window-created` (a new window may briefly sort by native
  creation order until the scheduled pass lands).
- Lifecycle: `disable()` clears ranks then disposes the controller (cancels
  debounce + chain timers); `enable()` re-creates it; `removePaperWMFlags()`
  deletes `_dtpPosition` on released windows.
- Commit history: first attempt `602a0b9` was reverted in `90fcd31` (the
  aider-generated patch had stray tokens that broke `tiling.js` parsing plus
  unrelated edits); the reworked implementation is `eeba63d`.

Tests: `tests/taskbar.test.js` (62 cases, plain `gjs`, fake clock) covers
debounce/deferral, ordering, signature gate, forced passes, clears,
dispose, startup chains, hostile inputs, and the §3.2 regression scenarios
(late-enabled panel converges; unchanged-order re-assert at startup; no
startup chain on a mid-session enable). `tests/tiling-taskbar.test.js` is a
shell-session wiring smoke test.

## Kill-switches & rollback

- Span mode: `tiling.js:52` `SPAN_ALL_MONITORS = true → false` restores upstream per-monitor Spaces without reverting other fixes (overview/patches guards are span-conditional).
- Taskbar sync: `sync-taskbar-order = false` (default) or disable the extension — zero effect without a compatible taskbar, and nothing runs inline (all work is debounced + idle-deferred; the startup chain is bounded by `startupResyncDelaysMs`/`startupPhaseMs` and cancelled on dispose).
- Focus behavior: set `default-focus-mode = 0` to restore upstream DEFAULT; pressing the legacy focus-mode UI still calls `setFocusMode` (clears `positionMode`). Set `focus-mode-enabled = false` to disable all focus auto-centering (cycle key re-enables and advances once).
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
