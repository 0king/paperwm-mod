# AGENTS.md — paperwm-mod

GNOME Shell extension (GJS, ES modules). No `package.json`, no test runner, no bundler.
Supported shells: 45–50 (`metadata.json`). No TS, no build step besides schema compile.

## Fork identity (easy to get wrong)

- Extension ID is `paperwm-mod@paperwm.github.com` (`Makefile:8`, `metadata.json`). Installs side-by-side with upstream PaperWM.
- Install path: `~/.local/share/gnome-shell/extensions/paperwm-mod@paperwm.github.com` (symlink to repo via `make install`).
- `README.md` examples still show the upstream `paperwm@...` ID — use the `-mod` ID for enable/disable paths here.

## Commands

- `make install` — symlink repo into extensions dir, then `gnome-extensions enable paperwm-mod@paperwm.github.com`. Requires Shell restart after first install (logout/login, or Alt-F2 `r` on X11 only).
- `make uninstall` — refuses unless target symlinks back to `$PWD`.
- `make release` — builds `paperwm-mod@paperwm.github.com.zip` for EGO review.
- **Never run `gnome-extensions install --force` while `$(TARGET)` is the dev symlink.** GNOME Shell 50.1's tool follows the symlink, empties the repo (including `.git`), then fails with `Can't recursively copy directory`; the extension then starts failing with `Missing metadata.json`. Test the release zip in a VM or a non-symlinked install instead (see `bugs/bugs.md` §3.4).
- `make test` — runs the gjs test suite (`tests/run.js`). `tests/lib.test.js` (pure functions) runs anywhere; the `tiling`/`navigator`/`scratch` suites require a GNOME Shell session (`gi://` imports resolve there — run inside `./shell.sh` or `nix run .#vm`). **Run `make test` after every change; a change is not complete until tests pass.**
- Schema: see [Schema changes — mandatory](#schema-changes--mandatory). `make test` fails when `schemas/gschemas.compiled` is stale.
- Lint: ESLint with `.eslintrc.yml` (GNOME GJS profile: 4-space indent, semicolons always, `eqeqeq`, no `==`). No lint script — run `eslint` directly on touched files.
- Tests: `make test` (runner `tests/run.js`, framework `tests/harness.js`). `tests/lib.test.js` runs in plain `gjs`; suites importing `gi://` modules need a shell session. Add a test file under `tests/` for every new behavior or bug fix (see `tests/` for patterns).
- Branch base is upstream `release`; PRs must target `develop` (bot auto-retargets `release` PRs — `.github/workflows/rebase-pr.yaml`).

## Schema changes — mandatory

`schemas/gschemas.compiled` is a tracked binary and **must always match** `schemas/org.gnome.shell.extensions.paperwm.gschema.xml`. If it is stale, the extension loads the old schema and fails at `enable()` with:

```
Error: GSettings key <key> not found in schema org.gnome.shell.extensions.paperwm
```

A stale binary can be committed even when all tests pass, because tests do not load GSettings — that is why `make test` now runs `make check-schema`.

For every schema edit (new/removed/renamed key, changed default/summary/description):

1. Edit `schemas/org.gnome.shell.extensions.paperwm.gschema.xml`.
2. Regenerate: `make -C schemas gschemas.compiled` (never hand-edit the binary).
3. Verify the key exists: `gsettings --schemadir schemas list-keys org.gnome.shell.extensions.paperwm | grep <key>`.
4. Run `make test` — it runs `make check-schema`, which recompiles into a temp dir and fails if the committed binary is stale.
5. Commit the XML **and** `schemas/gschemas.compiled` in the same commit.
6. After installing, restart GNOME Shell (logout/login; Alt-F2 `r` is X11-only) — GSettings caches compiled schemas per process.

History: `bugs/bugs.md` §4.1 — `f0c9242` shipped the `remember-window-sizes` key without the binary; fixed in `d81cd5d`.

## Architecture

- `extension.js` is the entrypoint: `enable()`/`disable()` iterate the module list. Order matters (see file header): `Settings` before consumers, `Settings` before `Patches` for reverse-order disable. `settings.js` must not import other paperwm modules.
- `imports.js` is the module registry — add new modules there and to the list in `extension.js`.
- `tiling.js` (~6700 lines) is the core: `Spaces`/`Space`, layout, viewport, focus. Other files are satellites: `keybindings.js`, `navigator.js` (discrete nav + drift snap ordering), `gestures.js` (touchpan), `scratch.js` (floating layer), `patches.js` (monkey-patches), `stackoverlay.js`, `topbar.js`, `workspace.js`, `prefs.js` + `*.ui` (settings UI), `taskbar.js` (Dash-to-Panel order-sync scheduler — library module imported directly by `tiling.js`).
- `config/user.js` is a stub; dynamic user-config loading is disabled (see commented block in `extension.js`).

## paperwm-mod deltas (see `CHANGES-paperwm-mod.md` — the branch changelog)

- `SPAN_ALL_MONITORS = true` kill-switch in `tiling.js:52`. `false` restores upstream per-monitor Spaces. Span helpers: `getMonitorsBoundingBox`, `computeSpannedWorkArea`, `getPrimaryWorkAreaSpanCoords`, `moveWindowToPrimaryMonitor`. `computeSpannedWorkArea` unions work areas horizontally but intersects their vertical bands, so top/bottom panels (GNOME top bar, Dash-to-Panel) on any monitor are never overlapped; vertically stacked monitors fall back to the union. Centering/focus/fullscreen target the **primary** monitor, not the span bounding box (which starts at the leftmost/upper monitor).
- Focus-mode key no longer rotates space-wide `DEFAULT→CENTER→EDGE`; it cycles per-space `positionMode` (null|0|1|2 = legacy, primary-left/center/right). `setFocusMode` clears `positionMode`; drift and manual touchpan (`gestures.js`) also clear it. `default-focus-mode` now defaults to `1` (CENTER).
- `Space._drift`/`driftLeft`/`driftRight` (`tiling.js:~1518+`): `driftTimeout` is a single global — never leave `drifting=true` without an active timeout; tick/snap errors must stop drift, not wedge the key grab.
- Taskbar sync (`taskbar.js`, dependency-injected, gi-free): a debounced + idle-deferred scheduler stamps `w._dtpPosition` in PaperWM order and nudges DTP through its own deferred redisplay (`createDashToPanelNudge()` → `Taskbar._queueRedisplay()`), signature-gated. Never emit `AppFavorites.changed` for this (shell-wide synchronous listeners stalled the main thread ~1.5 s; `bugs/bugs.md` §1.1) and never force a nudge from window-insertion paths — call `scheduleTaskbarSync()`; forced passes are only for the startup chain + `forceTaskbarResync()`. The login autostart burst is covered by a bounded forced-resync chain (`beginTaskbarStartupPhase()` when `Main.layoutManager._startingUp`). `disable()` clears ranks and disposes the controller. Gated by `sync-taskbar-order` (default `false`).
- All-monitors ws switch/move wrap at ends (`wrap=true` passed from `keybindings.js`); `select*/move*Space` default `wrap=false`.
- `patches.js` span guards are null-safe (`spaces?.`, try/catch) — keep that pattern so a missing `Space` never breaks overview rendering.

## Testing

Test files live under `tests/` and use the `tests/harness.js` framework (`describe`/`it`/`assert`/`eq`/`approx`/`throws`/`runAndExit`). `tests/run.js` imports every suite and reports a combined pass/fail with a non-zero exit code on failure.

| File | What it covers | Runs in plain gjs? |
|------|----------------|---------------------|
| `tests/lib.test.js` | `lib.js` pure functions (`findNext`/`findPrev`, `arrayEqual`, `eq`, `swap`, `in_bounds`, `indent`, `sum`, `zip`, `computeSpanWorkArea` panel-band math) | Yes |
| `tests/tiling-span.test.js` | `SPAN_ALL_MONITORS`, `getMonitorsBoundingBox`, `computeSpannedWorkArea` (incl. panel/work-area insets, vertically stacked fallback), `getPrimaryWorkAreaSpanCoords`, `moveWindowToPrimaryMonitor` | No (needs `gi://` + `resource:///`) |
| `tests/tiling-focus.test.js` | `FocusModes`, `isFocusModeEnabled`, `setFocusModeEnabled`, `getDefaultFocusMode`, `getWindowPositionTargets`, cycle logic | No |
| `tests/tiling-taskbar.test.js` | Shell-session wiring smoke tests: historical taskbar exports exist and never throw; `clearTaskbarPosition` rank deletion | No |
| `tests/taskbar.test.js` | `taskbar.js` scheduler (plain gjs, fake clock): debounce/deferral, ordering, signature gate, forced passes, clears, dispose, startup burst chains, DTP nudge targeting, `bugs/bugs.md` §1.1 + §3.2 regressions | Yes |
| `tests/tiling-wrap.test.js` | `selectDownSpace`/`selectUpSpace`/`moveDownSpace`/`moveUpSpace` `wrap` param, `selectSequenceSpace` | No |
| `tests/scratch.test.js` | `makeScratch`/`unmakeScratch` state contract, taskbar-rank cleanup, gated (never forced) taskbar re-schedule | No |
| `tests/navigator.test.js` | `primaryModifier` bit isolation | No |

The gi-dependent suites (`tiling/*`, `scratch`, `navigator`) import `gi://` and `resource:///org/gnome/shell/...` which only resolve inside a running GNOME Shell. Run them with `make test` inside `./shell.sh` or `nix run .#vm`. `tests/lib.test.js` and `tests/taskbar.test.js` run anywhere via `gjs -m tests/run.js` or `make test`.

`tests/mocks.js` provides `MockMonitor`, `MockWindow`, `MockSpace`, `MockSpaces`, `MockSettings`, and `makeGlobalMock()` for building controlled inputs in shell-session tests.

**Rule: add a test file (or cases to an existing one) under `tests/` for every new behavior or bug fix.** A change is not complete until `make test` passes.

## Adding/changing a setting — all 5 places

1. `schemas/...gschema.xml`
2. `schemas/gschemas.compiled` — regenerate and commit the binary ([mandatory checklist](#schema-changes--mandatory))
3. `settings.js` `prefs` key list in `enable()`
4. `Settings.ui` widget
5. `prefs.js` binding (e.g. `booleanStateChanged`)

Run `make test` (it includes `make check-schema`) before committing.

## code edit best practices
- whenever code changes, document it in CHANGES-paperwm-mod.md with your findings in brief (problem, solution).
- run tests after edits to check regression
- when a bug is reported, document it in bugs/ with a brief description.
- ask clarifying questions, dont assume
- write tests for new features
- robust error handling, especially for critical segments which can crash the whole extension.

Live-toggle side effects for the running session go in `tiling.js` (see `sync-taskbar-order` handler), not in `prefs.js`.
