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
- `make test` — runs the gjs test suite (`tests/run.js`). `tests/lib.test.js` (pure functions) runs anywhere; the `tiling`/`navigator`/`scratch` suites require a GNOME Shell session (`gi://` imports resolve there — run inside `./shell.sh` or `nix run .#vm`). **Run `make test` after every change; a change is not complete until tests pass.**
- Schema: after editing `schemas/org.gnome.shell.extensions.paperwm.gschema.xml`, regenerate with `make -C schemas gschemas.compiled` (i.e. `glib-compile-schemas .`) and **commit the binary** — prior commits do (`4476975`, `83e5f75`).
- Lint: ESLint with `.eslintrc.yml` (GNOME GJS profile: 4-space indent, semicolons always, `eqeqeq`, no `==`). No lint script — run `eslint` directly on touched files.
- Tests: `make test` (runner `tests/run.js`, framework `tests/harness.js`). `tests/lib.test.js` runs in plain `gjs`; suites importing `gi://` modules need a shell session. Add a test file under `tests/` for every new behavior or bug fix (see `tests/` for patterns).
- Branch base is upstream `release`; PRs must target `develop` (bot auto-retargets `release` PRs — `.github/workflows/rebase-pr.yaml`).

## Architecture

- `extension.js` is the entrypoint: `enable()`/`disable()` iterate the module list. Order matters (see file header): `Settings` before consumers, `Settings` before `Patches` for reverse-order disable. `settings.js` must not import other paperwm modules.
- `imports.js` is the module registry — add new modules there and to the list in `extension.js`.
- `tiling.js` (~6700 lines) is the core: `Spaces`/`Space`, layout, viewport, focus. Other files are satellites: `keybindings.js`, `navigator.js` (discrete nav + drift snap ordering), `gestures.js` (touchpan), `scratch.js` (floating layer), `patches.js` (monkey-patches), `stackoverlay.js`, `topbar.js`, `workspace.js`, `prefs.js` + `*.ui` (settings UI).
- `config/user.js` is a stub; dynamic user-config loading is disabled (see commented block in `extension.js`).

## paperwm-mod deltas (see `CHANGES-paperwm-mod.md` — the branch changelog)

- `SPAN_ALL_MONITORS = true` kill-switch in `tiling.js:52`. `false` restores upstream per-monitor Spaces. Span helpers: `getMonitorsBoundingBox`, `computeSpannedWorkArea`, `getPrimaryWorkAreaSpanCoords`, `moveWindowToPrimaryMonitor`. Centering/focus/fullscreen target the **primary** monitor, not the span bounding box (which starts at the leftmost/upper monitor).
- Focus-mode key no longer rotates space-wide `DEFAULT→CENTER→EDGE`; it cycles per-space `positionMode` (null|0|1|2 = legacy, primary-left/center/right). `setFocusMode` clears `positionMode`; drift and manual touchpan (`gestures.js`) also clear it. `default-focus-mode` now defaults to `1` (CENTER).
- `Space._drift`/`driftLeft`/`driftRight` (`tiling.js:~1518+`): `driftTimeout` is a single global — never leave `drifting=true` without an active timeout; tick/snap errors must stop drift, not wedge the key grab.
- Taskbar sync stamps `w._dtpPosition` and nudges via `AppFavorites.changed` (signature-gated); `clearTaskbarOrder()` on disable/setting-off. Gated by `sync-taskbar-order` (default `false`).
- All-monitors ws switch/move wrap at ends (`wrap=true` passed from `keybindings.js`); `select*/move*Space` default `wrap=false`.
- `patches.js` span guards are null-safe (`spaces?.`, try/catch) — keep that pattern so a missing `Space` never breaks overview rendering.

## Testing

Test files live under `tests/` and use the `tests/harness.js` framework (`describe`/`it`/`assert`/`eq`/`approx`/`throws`/`runAndExit`). `tests/run.js` imports every suite and reports a combined pass/fail with a non-zero exit code on failure.

| File | What it covers | Runs in plain gjs? |
|------|----------------|---------------------|
| `tests/lib.test.js` | `lib.js` pure functions (`findNext`/`findPrev`, `arrayEqual`, `eq`, `swap`, `in_bounds`, `indent`, `sum`, `zip`) | Yes |
| `tests/tiling-span.test.js` | `SPAN_ALL_MONITORS`, `getMonitorsBoundingBox`, `computeSpannedWorkArea`, `getPrimaryWorkAreaSpanCoords`, `moveWindowToPrimaryMonitor` | No (needs `gi://` + `resource:///`) |
| `tests/tiling-focus.test.js` | `FocusModes`, `isFocusModeEnabled`, `setFocusModeEnabled`, `getDefaultFocusMode`, `getWindowPositionTargets`, cycle logic | No |
| `tests/tiling-taskbar.test.js` | `syncTaskbarOrder`, `stampProvisionalTaskbarPosition`, `forceTaskbarResync`, `clearTaskbarPosition`, `clearTaskbarOrder` | No |
| `tests/tiling-wrap.test.js` | `selectDownSpace`/`selectUpSpace`/`moveDownSpace`/`moveUpSpace` `wrap` param, `selectSequenceSpace` | No |
| `tests/scratch.test.js` | `makeScratch`/`unmakeScratch` state contract, taskbar-rank cleanup | No |
| `tests/navigator.test.js` | `primaryModifier` bit isolation | No |

The gi-dependent suites (`tiling/*`, `scratch`, `navigator`) import `gi://` and `resource:///org/gnome/shell/...` which only resolve inside a running GNOME Shell. Run them with `make test` inside `./shell.sh` or `nix run .#vm`. `tests/lib.test.js` runs anywhere via `gjs -m tests/lib.test.js` or `make test`.

`tests/mocks.js` provides `MockMonitor`, `MockWindow`, `MockSpace`, `MockSpaces`, `MockSettings`, and `makeGlobalMock()` for building controlled inputs in shell-session tests.

**Rule: add a test file (or cases to an existing one) under `tests/` for every new behavior or bug fix.** A change is not complete until `make test` passes.

## Adding/changing a setting — all 4 places

1. `schemas/...gschema.xml` (+ recompile binary, commit it)
2. `settings.js` `prefs` key list in `enable()`
3. `Settings.ui` widget
4. `prefs.js` binding (e.g. `booleanStateChanged`)

Live-toggle side effects for the running session go in `tiling.js` (see `sync-taskbar-order` handler), not in `prefs.js`.
