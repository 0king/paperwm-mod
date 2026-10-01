# Security Audit — paperwm-mod

**Date:** 2026-10-01
**Branch audited:** `durjan/paperwm-mod` (commits `fa9628e`, `f9bd983` on top of `origin/release`)
**Scope:** full working tree — JS extension, shell scripts, nix files, workflows, resources, schemas
**Verdict:** No malware, backdoor, exfiltration, or obfuscated payload found.

## 1. Methodology (read-only)
- `git log/diff/status`, remote check
- File listing (`ls -la`, `media/`, `resources/`, `config/`, `schemas/`, `examples/`)
- Pattern search: `eval|Function|spawn|Soup|fetch|XMLHttpRequest|base64|fromCharCode|ssh|secret|token|clipboard`
- Manual review of every hit with file:line context
- Validated `flake.lock` sources, `gschemas.compiled` magic bytes, workflow YAML, nix modules

## 2. Custom changes (future reference)
This fork differs from `origin/release` only by:

- `fa9628e` Rename extension to `paperwm-mod@paperwm.github.com` and add span-all-monitors mode
- `f9bd983` Force fullscreen windows to primary monitor in span mode

Touched files (`+581/-100`):
- `Makefile:8` — `EXT_ID := paperwm-mod@paperwm.github.com`
- `metadata.json:2-3` — `uuid` + `name: PaperWM (Mod)`
- `keybindings.js:344` — `Tiling.moveWindowToPrimaryMonitor()` before `make_fullscreen()`
- `tiling.js` — `SPAN_ALL_MONITORS=true` kill-switch, `getMonitorsBoundingBox()`, `computeSpannedWorkArea()`, `getPrimaryWorkAreaSpanCoords()`, `moveWindowToPrimaryMonitor()`, span-aware `workArea()`, `layout()`, `isPlaceable()`, `ensuredX()`, `Spaces` spanning init, `_updateMonitor`/`switchMonitor`/`moveToMonitor`/`swapMonitor` guards
- `patches.js` — null-safe `spaces?.` + span-aware `_isMyWindow`, workspace-count minimum `2:1` in span mode
- `stackoverlay.js:60` — skip per-monitor overlays when spanning

No network, secrets, or persistence added by these commits.

## 3. Findings by category

### 3.1 Code execution / spawn — all legitimate
- `app.js:98,178` `GLib.spawn_async()` — launches user apps from `.desktop Exec=` lines. Expected for WM.
- `prefs.js:338` `GLib.spawn_async(['gnome-control-center','background'])` — settings button.
- `extension.js:202` `Util.spawn(["sh","-c", echo | gedit])` — error pager, uses `GLib.shell_quote()`. Safe.
- `shell.sh:22` `eval $(dbus-launch ...)` — dev nested-session helper only.
- `debug:70` `eval $DATA` — consumes `journalctl -o json | jq @sh`. Local input only, `@sh` quoting. Low risk.
- No `Soup / Message.new / fetch / XMLHttpRequest / WebSocket / Gio.Socket / child_process / require(http)`.

### 3.2 Filesystem / secrets — clean
- Writes limited to `~/.config/paperwm/` (`extension.js:94-185`), `/tmp/paperwm.workspace` int IPC (`topbar.js:757-758`, `prefs.js:29-30`), background image paths (`background.js:485,496,575`).
- No access to `~/.ssh`, `~/.gnupg`, `/etc/shadow`, `password/token/api_key/wallet/mnemonic`.
- No `base64 / atob / fromCharCode / \x` blobs, no minified payloads.

### 3.3 Network / D-Bus / clipboard
- No outbound HTTP. D-Bus only `org.gnome.Mutter.DisplayConfig` (`utils.js:631-707`) for monitor connectors.
- Clipboard only on user action: `prefs.js:495-499` copy-version-info, `shell.sh:26` dev dbus-address copy.

### 3.4 Supply chain / build
- `flake.lock` pins only `NixOS/nixpkgs`, `numtide/flake-utils`, `nix-systems/default`, `vitorpavani/nixpkgs:gnome-50-bump`.
- `default.nix / shell.nix / vm.nix / flake.nix` trivial. Note `vm.nix:47,52` test creds `user:paperwm` + `NOPASSWD` — test VM only.
- `.github/workflows/rebase-pr.yaml` only retargets PRs `release -> develop`.
- `schemas/gschemas.compiled` verified `GVariant` magic, 12333 bytes, generated artifact.
- `config/user.js` is stub, dynamic loading disabled. `media/`, `resources/`, `examples/` are images/SVG/samples.

## 4. Residual risk (by design)
GNOME Shell extensions run unsandboxed JS with full session privileges. Any extension — including upstream PaperWM — is high-privilege. This audit does not remove that inherent trust requirement, it only confirms this tree adds no extra malicious behavior.

## 5. Recommendations for future pulls
1. Stay on `durjan/paperwm-mod`; re-run `git diff release..HEAD --stat` + pattern grep before merging upstream.
2. Treat `~/.config/paperwm/user.js` as arbitrary code if ever enabled.
3. Regenerate `schemas/gschemas.compiled` at build time; exclude `shell.sh` / `vm.nix` from release zips.
4. Re-run this checklist after each upstream `develop -> release` merge.

## 6. How this audit was reproduced
```bash
git log --oneline release..HEAD
git diff release..HEAD --stat
# grep eval/spawn/Soup/base64/ssh/token/clipboard across *.js/*.sh/*.nix
ls -la; ls -l media/ resources/ examples/ config/ schemas/
python3 -c "import pathlib; print(pathlib.Path('schemas/gschemas.compiled').read_bytes()[:16])"
```
