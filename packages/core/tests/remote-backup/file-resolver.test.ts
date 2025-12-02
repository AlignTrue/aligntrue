/**
 * Tests for remote backup file resolver
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  resolveFileAssignments,
  getBackupStatus,
} from "../../src/remote-backup/file-resolver.js";
import type { RemoteBackupConfig } from "../../src/remote-backup/types.js";

const TEST_DIR = join(__dirname, "../../../temp-test-file-resolver");

describe("resolveFileAssignments", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, "rules"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should assign all files to default backup when no additional backups", () => {
    // Create test files
    writeFileSync(join(TEST_DIR, "rules/typescript.md"), "# TypeScript");
    writeFileSync(join(TEST_DIR, "rules/testing.md"), "# Testing");

    const config: RemoteBackupConfig = {
      default: {
        url: "git@github.com:user/rules.git",
      },
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"));

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]!.backupId).toBe("default");
    expect(result.assignments[0]!.files).toContain("typescript.md");
    expect(result.assignments[0]!.files).toContain("testing.md");
    expect(result.warnings).toHaveLength(0);
  });

  it("should assign files to additional backups based on include patterns", () => {
    writeFileSync(join(TEST_DIR, "rules/typescript.md"), "# TypeScript");
    writeFileSync(join(TEST_DIR, "rules/testing.md"), "# Testing");
    writeFileSync(join(TEST_DIR, "rules/security.md"), "# Security");

    const config: RemoteBackupConfig = {
      default: {
        url: "git@github.com:user/all-rules.git",
      },
      additional: [
        {
          id: "public-oss",
          url: "git@github.com:user/public-rules.git",
          include: ["typescript.md", "testing.md"],
        },
      ],
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"));

    expect(result.assignments).toHaveLength(2);

    const publicBackup = result.assignments.find(
      (a) => a.backupId === "public-oss",
    );
    const defaultBackup = result.assignments.find(
      (a) => a.backupId === "default",
    );

    expect(publicBackup?.files).toContain("typescript.md");
    expect(publicBackup?.files).toContain("testing.md");
    expect(publicBackup?.files).not.toContain("security.md");

    expect(defaultBackup?.files).toContain("security.md");
    expect(defaultBackup?.files).not.toContain("typescript.md");
  });

  it("should support glob patterns in include", () => {
    mkdirSync(join(TEST_DIR, "rules/guides"), { recursive: true });
    writeFileSync(join(TEST_DIR, "rules/guides/react.md"), "# React");
    writeFileSync(join(TEST_DIR, "rules/guides/vue.md"), "# Vue");
    writeFileSync(join(TEST_DIR, "rules/security.md"), "# Security");

    const config: RemoteBackupConfig = {
      default: {
        url: "git@github.com:user/all-rules.git",
      },
      additional: [
        {
          id: "public-guides",
          url: "git@github.com:user/public-guides.git",
          include: ["guides/*.md"],
        },
      ],
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"));

    const guidesBackup = result.assignments.find(
      (a) => a.backupId === "public-guides",
    );
    expect(guidesBackup?.files).toContain("guides/react.md");
    expect(guidesBackup?.files).toContain("guides/vue.md");
    expect(guidesBackup?.files).not.toContain("security.md");
  });

  it("should warn on duplicate file assignments", () => {
    writeFileSync(join(TEST_DIR, "rules/typescript.md"), "# TypeScript");

    const config: RemoteBackupConfig = {
      additional: [
        {
          id: "backup-a",
          url: "git@github.com:user/backup-a.git",
          include: ["typescript.md"],
        },
        {
          id: "backup-b",
          url: "git@github.com:user/backup-b.git",
          include: ["typescript.md"],
        },
      ],
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"));

    // First backup gets the file
    const backupA = result.assignments.find((a) => a.backupId === "backup-a");
    expect(backupA?.files).toContain("typescript.md");

    // Second backup doesn't get the file
    const backupB = result.assignments.find((a) => a.backupId === "backup-b");
    expect(backupB).toBeUndefined(); // No files assigned

    // Warning generated
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.type).toBe("duplicate");
    expect(result.warnings[0]!.message).toContain("typescript.md");
  });

  it("should warn on source/backup URL conflict", () => {
    writeFileSync(join(TEST_DIR, "rules/typescript.md"), "# TypeScript");

    const config: RemoteBackupConfig = {
      default: {
        url: "git@github.com:user/rules.git",
      },
    };

    const sourceUrls = ["git@github.com:user/rules.git"];

    const result = resolveFileAssignments(
      config,
      join(TEST_DIR, "rules"),
      sourceUrls,
    );

    // Backup should be skipped
    expect(result.assignments).toHaveLength(0);

    // Warning generated
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.type).toBe("source-backup-conflict");
    expect(result.warnings[0]!.message).toContain("source and backup");
  });

  it("should warn on orphan files when no default backup", () => {
    writeFileSync(join(TEST_DIR, "rules/typescript.md"), "# TypeScript");
    writeFileSync(join(TEST_DIR, "rules/orphan.md"), "# Orphan");

    const config: RemoteBackupConfig = {
      additional: [
        {
          id: "specific",
          url: "git@github.com:user/specific.git",
          include: ["typescript.md"],
        },
      ],
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"));

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.type).toBe("orphan");
    expect(result.warnings[0]!.files).toContain("orphan.md");
  });
});

describe("getBackupStatus", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, "rules"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should return status for all backups", () => {
    writeFileSync(join(TEST_DIR, "rules/typescript.md"), "# TypeScript");
    writeFileSync(join(TEST_DIR, "rules/testing.md"), "# Testing");

    const config: RemoteBackupConfig = {
      default: {
        url: "git@github.com:user/all.git",
        branch: "main",
      },
      additional: [
        {
          id: "public",
          url: "git@github.com:user/public.git",
          include: ["typescript.md"],
        },
      ],
    };

    const { backups, warnings } = getBackupStatus(
      config,
      join(TEST_DIR, "rules"),
    );

    expect(backups).toHaveLength(2);
    expect(backups.find((b) => b.id === "default")).toBeDefined();
    expect(backups.find((b) => b.id === "public")).toBeDefined();
    expect(warnings).toHaveLength(0);
  });
});
