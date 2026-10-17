# bugs
bugs that frequently keep recurring after code is modified. add comprehensive tests for all these bugs to avoid regression. when a new bug is found, update this file with a brief description.

1. scratch layer bugs
1.1 conflict between scratch layer and a always-on-top window: scratch layer despite being over the window fails to get focus
1.1 opening a app associated with scratch layer fails to open or window open delayed by 2-3 seconds

2. focus mode 
2.1 focus mode activation: focus mode is activated either through direct toggle action or in case change focus mode state (left, center, right) action is called

3. dash to panel extension
3.1 order of windows is different: dash to panel groups app windows together unlike paperwm which follows its own rule (current setting: open new window to end)
3.2 on startup bug: when some apps are scheduled to open on startup, app icons are missing in dash to panel though windows do open. this happens only during startup otherwise icons are visible as expected. e.g., if three windows open (brave1, obsidian, brave2), obsidian icon is not visible. or if obsidian is visible then brave1 and brave2 icons are missing. 
   3.2.1 root cause: taskbar order was stamped + nudged synchronously from `Space.layout()`/`window-created` during the autostart burst; the nudge could reach DTP before DTP itself finished enabling (or after it painted an early snapshot), and the signature gate then suppressed any later nudge because the order had not changed since. Result: an icon (or two) stays missing until the next order change. A first attempt at a fix (commit `602a0b9`) was reverted in `90fcd31` for breaking `tiling.js` (stray tokens + unrelated edits).
   3.2.2 fix (`eeba63d`): taskbar logic moved to `taskbar.js`, a dependency-injected scheduler — every pass is debounced (50 ms) + idle-deferred (no synchronous work in layout/signal handlers), nudges are signature-gated, and during login the shell `enable()` starts a bounded "startup phase" that arms forced re-assert chains (1 s / 3 s / 8 s, phase capped at 30 s) so a late- or slow-to-enable DTP converges. `disable()` disposes the scheduler and clears ranks. See `taskbar.js` header.
   3.2.3 regression tests: `tests/taskbar.test.js` (62 cases, fake clock, incl. the exact login-burst scenarios: late-enabled panel converges; single-app order unchanged still re-asserted; mid-session enable gets no startup chain). Wiring smoke tests: `tests/tiling-taskbar.test.js`. Required DTP dconf settings are documented in `CHANGES-paperwm-mod.md` §9.

