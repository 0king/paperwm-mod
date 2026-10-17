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
