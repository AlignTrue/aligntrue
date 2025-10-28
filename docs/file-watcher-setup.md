# File Watcher Setup Guide

Auto-sync your rules when you save changes to agent files. This guide provides the fastest and most reliable options for each platform.

---

## Quick Start

For each platform, we provide two options:
1. **Fastest**: Quickest to set up (1-2 minutes)
2. **Most Reliable**: Production-ready, handles edge cases

---

## VS Code (Fastest: ~2 minutes)

### Option 1: VS Code Task (Fastest)

**Create `.vscode/tasks.json`:**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "AlignTrue Auto-Sync",
      "type": "shell",
      "command": "aligntrue sync",
      "presentation": {
        "reveal": "silent",
        "panel": "dedicated",
        "showReuseMessage": false
      },
      "runOptions": {
        "runOn": "folderOpen"
      }
    }
  ]
}
```

**Create `.vscode/settings.json`:**

```json
{
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
  "task.autoDetect": "on"
}
```

**Usage:**
- Files auto-save after 1 second of inactivity
- Task runs `aligntrue sync` automatically
- Silent output (check Terminal if needed)

### Option 2: VS Code Extension (Most Reliable)

Install **Run on Save** extension:

1. Open Extensions (Cmd/Ctrl+Shift+X)
2. Search "Run on Save"
3. Install by `emeraldwalk`

**Create `.vscode/settings.json`:**

```json
{
  "emeraldwalk.runonsave": {
    "commands": [
      {
        "match": "\\.cursor/rules/.*\\.mdc$",
        "cmd": "aligntrue sync"
      },
      {
        "match": "AGENTS\\.md$",
        "cmd": "aligntrue sync"
      }
    ]
  }
}
```

**Advantages:**
- Only runs on specific file changes
- Handles rapid edits gracefully
- Shows sync status in output panel

---

## macOS Terminal

### Option 1: fswatch (Fastest)

**Install:**

```bash
brew install fswatch
```

**Create `watch-sync.sh`:**

```bash
#!/bin/bash
fswatch -o .cursor/rules AGENTS.md | while read; do
  echo "$(date): Files changed, syncing..."
  aligntrue sync
done
```

**Run:**

```bash
chmod +x watch-sync.sh
./watch-sync.sh
```

**Stop:** Ctrl+C

### Option 2: nodemon (Most Reliable)

**Install:**

```bash
npm install -g nodemon
```

**Create `nodemon.json`:**

```json
{
  "watch": [".cursor/rules/**/*.mdc", "AGENTS.md"],
  "ext": "mdc,md",
  "exec": "aligntrue sync",
  "delay": 1000
}
```

**Run:**

```bash
nodemon
```

**Advantages:**
- Debounces rapid changes (1 second delay)
- Handles renames and deletes
- Restarts on crash
- Production-ready

---

## Linux

### Option 1: inotifywait (Fastest)

**Install (Ubuntu/Debian):**

```bash
sudo apt-get install inotify-tools
```

**Install (Fedora/RHEL):**

```bash
sudo dnf install inotify-tools
```

**Create `watch-sync.sh`:**

```bash
#!/bin/bash
while inotifywait -r -e modify,create,delete .cursor/rules AGENTS.md; do
  sleep 1  # Debounce
  echo "$(date): Syncing..."
  aligntrue sync
done
```

**Run:**

```bash
chmod +x watch-sync.sh
./watch-sync.sh
```

### Option 2: nodemon (Most Reliable)

Same as macOS Option 2 above.

**Install:**

```bash
npm install -g nodemon
```

**Create `nodemon.json`:** (same as macOS)

**Run:**

```bash
nodemon
```

---

## Windows

### Option 1: PowerShell FileSystemWatcher (Fastest)

**Create `watch-sync.ps1`:**

```powershell
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = ".cursor\rules"
$watcher.Filter = "*.mdc"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

$action = {
    Start-Sleep -Seconds 1  # Debounce
    Write-Host "$(Get-Date): Syncing..."
    aligntrue sync
}

Register-ObjectEvent $watcher "Changed" -Action $action
Register-ObjectEvent $watcher "Created" -Action $action
Register-ObjectEvent $watcher "Deleted" -Action $action

Write-Host "Watching .cursor\rules for changes..."
while ($true) { Start-Sleep -Seconds 1 }
```

**Run:**

```powershell
.\watch-sync.ps1
```

**Stop:** Ctrl+C

### Option 2: nodemon (Most Reliable)

Same as macOS/Linux Option 2 above.

**Install:**

```powershell
npm install -g nodemon
```

**Create `nodemon.json`:** (same format, use forward slashes)

**Run:**

```powershell
nodemon
```

---

## Background Service (Production)

For always-on file watching, run as a background service.

### macOS: launchd

**Create `~/Library/LaunchAgents/com.aligntrue.watch.plist`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.aligntrue.watch</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/nodemon</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/your/project</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

**Load service:**

```bash
launchctl load ~/Library/LaunchAgents/com.aligntrue.watch.plist
```

**Unload service:**

```bash
launchctl unload ~/Library/LaunchAgents/com.aligntrue.watch.plist
```

### Linux: systemd

**Create `~/.config/systemd/user/aligntrue-watch.service`:**

```ini
[Unit]
Description=AlignTrue Auto Sync
After=default.target

[Service]
Type=simple
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/nodemon
Restart=always

[Install]
WantedBy=default.target
```

**Enable and start:**

```bash
systemctl --user enable aligntrue-watch.service
systemctl --user start aligntrue-watch.service
```

**Check status:**

```bash
systemctl --user status aligntrue-watch.service
```

### Windows: Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Name: "AlignTrue Auto Sync"
4. Trigger: "When I log on"
5. Action: "Start a program"
6. Program: `nodemon`
7. Start in: `C:\path\to\your\project`
8. Finish

---

## Troubleshooting

### Sync Runs Too Often

**Problem:** File saves trigger multiple syncs

**Solution:** Add debounce delay

```json
{
  "delay": 2000  // Wait 2 seconds before syncing
}
```

### Sync Doesn't Trigger

**Problem:** File watcher not detecting changes

**Solutions:**
1. Check file paths are correct
2. Verify `aligntrue sync` works manually
3. Check watcher is running (`ps aux | grep nodemon`)
4. Restart watcher service

### VS Code Task Won't Run

**Problem:** Task not executing on file save

**Solutions:**
1. Open Command Palette (Cmd/Ctrl+Shift+P)
2. Search "Tasks: Run Task"
3. Select "AlignTrue Auto-Sync"
4. Check Terminal output for errors

### High CPU Usage

**Problem:** File watcher using too much CPU

**Solutions:**
1. Exclude unnecessary directories:
```json
{
  "ignore": ["node_modules", ".git", "dist"]
}
```
2. Increase delay between checks
3. Use more targeted watch patterns

### Permission Errors

**Problem:** "EACCES" or "permission denied"

**Solutions (macOS/Linux):**
```bash
chmod +x watch-sync.sh
chmod 755 .cursor/rules
```

**Solutions (Windows):**
- Run PowerShell as Administrator
- Check file permissions in folder properties

---

## Performance Tips

1. **Watch specific directories only** (not entire project)
2. **Add debounce delay** (1-2 seconds)
3. **Exclude large directories** (node_modules, .git)
4. **Use nodemon** for production (most optimized)
5. **Limit concurrent syncs** (nodemon handles this)

---

## Recommendation by Use Case

| Use Case | Recommendation | Why |
|----------|---------------|-----|
| Solo dev, VS Code | VS Code Task | Built-in, no install |
| Solo dev, any editor | nodemon | Universal, reliable |
| Team, CI/CD | systemd/launchd | Always on, restarts |
| Windows power user | PowerShell | Native, no dependencies |
| Quick experiment | fswatch/inotifywait | Minimal setup |

---

## Next Steps

1. Choose option for your platform
2. Set up file watcher (fastest option first)
3. Edit `.cursor/rules/*.mdc` or `AGENTS.md`
4. Save and verify sync runs automatically
5. If issues, try "most reliable" option

**Questions?** Check `docs/troubleshooting.md` or open an issue.

---

**Last Updated:** 2025-10-28  
**AlignTrue Version:** Phase 1 Complete

