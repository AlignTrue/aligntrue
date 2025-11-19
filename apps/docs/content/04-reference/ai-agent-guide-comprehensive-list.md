---
title: AI Agent Guide - A comprehensive list
description: A comprehensive list of AI agents, their supported rule formats and MCP support.
sidebar: false
---

# AI Agents: A comprehensive guide

This is a comprehensive list of AI agents, their supported rule formats and MCP support. If you're looking AlignTrue's ompatibility matrix, see [Agent Support](/docs/04-reference/agent-support).

If you see anything missing or out of date, submit an update.

## AI agent rule format support

| Agent — exporter                    | Supported formats                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Aider — `aider`                     | Rules: `AGENTS.md`, `.aider.conf.yml`<br>MCP: `.mcp.json`                                                |
| Amazon Q — `amazonq`                | Rules: `.amazonq/rules/*.md` (includes `ruler_q_rules.md` and related files)<br>MCP: `.amazonq/mcp.json` |
| Amp — `amp`                         | Rules: `AGENTS.md`                                                                                       |
| Augment Code — `augmentcode`        | Rules: `.augment/rules/*.md` (includes `ruler_augment_instructions.md`)                                  |
| Claude — `claude`                   | Rules: `CLAUDE.md`<br>MCP: `.mcp.json`                                                                   |
| Cline — `cline`                     | Rules: `.clinerules`                                                                                     |
| CrushChat — `crush`                 | Rules: `AGENTS.md`, `CRUSH.md`<br>Config: `.crush.json`                                                  |
| Cursor — `cursor`                   | Rules: `.cursor/rules/*.mdc`, `AGENTS.md`<br>MCP: `.cursor/mcp.json`                                     |
| Firebender — `firebender`           | Rules: `firebender.json`<br>Config: `firebender.json`                                                    |
| Firebase Studio — `firebase-studio` | Rules: `.idx/airules.md`<br>MCP: `.idx/mcp.json`                                                         |
| Gemini — `gemini`                   | Rules: `AGENTS.md`, `GEMINI.md`<br>Config: `.gemini/settings.json`                                       |
| Goose — `goose`                     | Rules: `.goosehints`                                                                                     |
| Junie — `junie`                     | Rules: `.junie/guidelines.md`<br>Config: `.aiignore`                                                     |
| KiloCode — `kilocode`               | Rules: `.kilocode/rules/*.md` (includes `ruler_kilocode_instructions.md`)<br>MCP: `.kilocode/mcp.json`   |
| Kiro — `kiro`                       | Rules: `.kiro/steering/*.md` (includes `ruler_kiro_instructions.md`)                                     |
| OpenAI Codex — `openai-codex`       | Rules: `AGENTS.md`<br>Config: `.codex/config.toml`                                                       |
| Open Code — `opencode`              | Rules: `AGENTS.md`<br>Config: `opencode.json`                                                            |
| OpenHands — `openhands`             | Rules: `.openhands/microagents/repo.md`<br>Config: `config.toml`                                         |
| Qwen Code — `qwen-code`             | Rules: `AGENTS.md`<br>Config: `.qwen/settings.json`                                                      |
| Roo Code — `roocode`                | Rules: `AGENTS.md`<br>MCP: `.roo/mcp.json`                                                               |
| Trae AI — `trae-ai`                 | Rules: `.trae/rules/project_rules.md`                                                                    |
| Warp — `warp`                       | Rules: `WARP.md`                                                                                         |
| Windsurf — `windsurf`               | Rules: `AGENTS.md`<br>MCP: `.windsurf/mcp_config.json`                                                   |
| Zed — `zed`                         | Rules: `AGENTS.md`<br>Config: `.zed/settings.json`                                                       |
| Jules — `jules`                     | Rules: `AGENTS.md`                                                                                       |
| GitHub Copilot — `copilot`          | Rules: `AGENTS.md`<br>MCP: `.vscode/mcp.json`                                                            |
| OpenAI Codex CLI — `openai-codex`   | Rules: `AGENTS.md`<br>Config: `.codex/config.toml`                                                       |
| Amazon Q CLI — `amazonq`            | Rules: `.amazonq/rules/ruler_q_rules.md`<br>MCP: `.amazonq/mcp.json`                                     |
| AGENTS.md — `agents`                | Rules: `AGENTS.md`                                                                                       |

## Agent ignore file support

| Agent                                | Ignore format                               | Notes                                                                                              |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Claude Code                          | No dedicated file (custom solution pending) | Claude relies on `.gitignore`; a `.claudeignore` feature request is open.                          |
| Aider                                | `.aiderignore`                              | Follows Git-style syntax and can sit anywhere inside the repo; `--aiderignore` overrides location. |
| Amazon Q                             | Uses `.gitignore`                           | No project-specific ignore file yet; a `.q-ignore` proposal exists.                                |
| Firebase Studio (Gemini Code Assist) | `.aiexclude`                                | `.gitignore` syntax minus negation; files listed there stay hidden from Gemini indexing.           |
| Kilo Code                            | `.kilocodeignore`                           | Lives in `.kilocode` and mirrors Git ignore behavior.                                              |
| OpenHands                            | None (planned)                              | OpenHands has no ignore file yet; a `.openhandsignore` is discussed.                               |
| OpenHands Config                     | None                                        | Config.toml does not expose ignore patterns.                                                       |
| Zed (Zed Editor AI)                  | Uses `.gitignore`                           | Zed hides gitignored files unless `include_ignored` is enabled; no `.zedignore`.                   |
| Gemini CLI                           | `.geminiignore`                             | Works like a gitignore; Gemini CLI reloads after changes.                                          |
| Gemini Config                        | `.geminiignore` / `.aiexclude`              | Config respects the CLI ignore file and Firebase’s `.aiexclude`.                                   |
| Qwen Code                            | Uses `.gitignore`                           | Settings toggle whether gitignored files are considered.                                           |
| OpenCode                             | Uses `.gitignore`                           | OpenCode relies on `.gitignore` and offers an `.ignore` override to re-include files.              |
| Crush                                | `.crushignore`                              | Default honors `.gitignore`; `.crushignore` adds extra exclusions per project/subdir.              |
| Warp                                 | `.warpindexingignore`                       | Files matching the list are dropped from Warp’s indexing along with gitignored paths.              |
| Cline                                | `.clineignore`                              | Git-like syntax instructs Cline which files to skip.                                               |
| Goose                                | `.gooseignore`                              | Ensures Goose does not read or edit sensitive files.                                               |
| Firebender                           | Ignore list inside `firebender.json`        | The `ignore` array joins global and project configs to keep files private.                         |
| Trae AI                              | None documented                             | No dedicated ignore file has been published.                                                       |
| Junie (JetBrains)                    | `.aiignore`                                 | Files listed here require explicit approval before the AI reads or edits them.                     |
| Augment Code                         | `.augmentignore`                            | Git-style patterns; supports negation to include previously ignored files.                         |
| Kiro                                 | `.kiroignore`                               | Functions like a gitignore to stop Kiro from touching listed files.                                |
