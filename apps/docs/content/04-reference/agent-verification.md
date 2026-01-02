---
title: "Agent verification"
description: "Step-by-step checks to confirm every agent is reading the rules that AlignTrue exports."
---

# Agent verification

Use this guide whenever an AI agent is not referencing your rules. It covers the fastest checks for Cursor, GitHub Copilot, Claude Code, VS Code MCP agents, and any exporter that writes to `AGENTS.md`.

## Quick checklist

1. Run `aligntrue sync` to regenerate all exports.
2. Run `aligntrue status` to confirm config, exporters, and edit sources.
3. Run `aligntrue doctor` to confirm each export file exists at the printed path.
4. Open the agent-specific file below; confirm latest rules and a fresh content hash/footer.
5. Restart the agent or IDE so it reloads the updated file.

## Cursor (.cursor/rules/\*.mdc)

1. Run `aligntrue sync` to regenerate `.cursor/rules/*.mdc`.
2. Run `aligntrue status` and confirm `cursor` shows `✓ detected`.
3. In Cursor:
   - Settings → Features → Cursor Rules → ensure “Rules folder” is enabled.
   - Click “Open rules folder” and verify the path matches `aligntrue status`.
   - Open the `.mdc` file and confirm the content hash/footer matches your latest sync.
4. Restart Cursor. Prompt it with “What rules should I follow?” to confirm it cites your rules.

## GitHub Copilot, Claude Code, Aider, Windsurf (AGENTS.md)

1. Run `aligntrue status` and confirm `agents` (and any variants such as `claude`, `windsurf`) show `✓ detected`.
2. Inspect `AGENTS.md` at the repo root. The file should include your latest sections and a content hash footer from the last sync; if the footer did not change after `aligntrue sync`, rerun sync or recheck `.aligntrue/rules/`.
3. For Claude Code or other IDE-integrated agents, close and reopen the workspace after syncing.
4. In chat, ask “Summarize the rules from AGENTS.md” to verify the agent read the file.

## Claude desktop and CLAUDE.md

1. Run `aligntrue status` and ensure `claude` is enabled.
2. Run `aligntrue sync` so `CLAUDE.md` is regenerated.
3. Claude desktop reads `CLAUDE.md` from the workspace root. Reopen the folder if Claude was already running.

## VS Code MCP, Cursor MCP, Windsurf MCP, Amazon Q MCP

1. Confirm the relevant MCP exporter (e.g., `vscode-mcp`, `cursor-mcp`, `windsurf-mcp`, `amazonq-mcp`) shows `✓ detected` in `aligntrue status`.
2. Ensure `.vscode/mcp.json`, `.cursor/mcp.json`, `.windsurf/mcp_config.json`, or `.amazonq/mcp.json` exists and matches the exact path printed by `aligntrue doctor` (do not rely on defaults).
3. In VS Code:
   - Command Palette → “Model Context Protocol: Reload Servers” (or restart VS Code).
   - Open Settings → “Model Context Protocol” and verify the path matches the generated JSON file.
4. Trigger the MCP action (e.g., “List AlignTrue rules”) to confirm ownership.

## MCP-enabled terminals (Warp, Firebender, Junie, etc.)

1. Run `aligntrue doctor` to confirm each exporter’s config file exists (Warp uses `WARP.md`, Firebender uses `firebender.json`, etc.).
2. Restart the terminal or reload its AI panel so it re-reads the generated file.

## When rules still don’t load

- Edit rules in `.aligntrue/rules/` and run `aligntrue sync` to export to all agents. Agent files are read-only exports.
- If an agent continues to ignore the file, delete its cache directory (`.cursor/`, `.windsurf/`, etc.) only after confirming sync/status/doctor outputs, then re-run `aligntrue sync` and reopen the agent.
- For team mode, ensure the lockfile is up to date (`aligntrue sync` or `aligntrue check --ci`) before troubleshooting exports.

Still stuck? Run `aligntrue doctor --json` and attach the report to your support request so we can see which files exist.
