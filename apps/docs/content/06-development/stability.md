---
title: Stability and compatibility
description: Stability guarantees for specs, lock schemas, exporters, and experimental features.
---

# Stability and compatibility

AlignTrue optimizes for deterministic, reviewable changes. This page documents what is stable, what can change, and how experimental features are treated.

## Versioned contracts

- **Spec version**: The IR/schema version that AlignTrue reads and writes. Minor bumps may add optional fields. Breaking changes require an explicit migration path or a new major spec.
- **Lock schema version**: The on-disk lockfile schema for team mode. Minor bumps are backward compatible or auto-migratable. Breaking changes ship with a migration command and release notes.

## Change categories

- **Backward compatible**: Additive fields, new optional sections, stricter validation that matches documented behavior. No migration needed.
- **Auto-migratable**: Structural shifts that the CLI migrates for you (e.g., field moves). Comes with a migration command and release note.
- **Breaking**: Requires manual action. Documented in changelog and release notes with explicit steps.

## Exporter stability

- Core exporters (Cursor, `AGENTS.md`, VS Code/Claude Code) target byte-stable output for identical inputs. Changes must either be backward compatible or come with a migration + golden test update.
- New exporters start as experimental until they have golden coverage and documented contracts.

## Experimental surfaces

The following are **experimental** and may change faster than the stable surface:

- **Plugs** (slots/fills)
- **Overlays** (override/selector flows)
- **Multi-source** (git/remote source merging)

These are labeled as experimental in CLI help and may introduce breaking changes between minor versions. Use them with caution in CI-critical pipelines.

## Expectations for contributors

- Add or update golden tests when changing exporters or schema-to-IR shaping.
- Document compatibility impact in `CHANGELOG.md` for any non-trivial change.
- Gate experimental behavior behind flags or clearly labeled help text; do not silently change stable contracts.
