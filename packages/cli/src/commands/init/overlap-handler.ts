import { mkdirSync, cpSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import * as clack from "@clack/prompts";
import {
  getAlignTruePaths,
  getBestFormat,
  type RuleFile,
} from "@aligntrue/core";
import type { DuplicateFile, ScanResult } from "./rule-importer.js";
import { inferAgentTypeFromPath } from "./format-detection.js";

export interface OverlapHandlingResult {
  rules: RuleFile[];
  importAll: boolean;
}

export async function handleOverlapDetection(
  scanResult: ScanResult,
  cwd: string,
  nonInteractive: boolean,
): Promise<OverlapHandlingResult> {
  const { rules, duplicates, similarityGroups } = scanResult;

  const dupMessages: string[] = [];
  for (const group of similarityGroups) {
    const canonicalType = group.canonical.type;
    for (const dup of group.duplicates) {
      const percent = Math.round(dup.similarity * 100);
      dupMessages.push(
        `  ${dup.file.path} is ~${percent}% similar to ${canonicalType} rules`,
      );
    }
  }

  const allTypes = rules.map((r) => inferAgentTypeFromPath(r.path));
  const bestFormat = getBestFormat(
    allTypes,
    similarityGroups[0]?.canonical.type || "multi-file",
  );

  const overlapMessage =
    `Overlap detected:\n` +
    dupMessages.join("\n") +
    `\n\nRecommendation: Use ${bestFormat} format as your source (most structured).` +
    `\nSimilar files will be backed up to .aligntrue/.backups/init-duplicates/`;

  if (nonInteractive) {
    console.log(overlapMessage);
    console.log(
      `\nUsing recommended import strategy (multi-file format preferred).`,
    );

    await backupDuplicateFiles(duplicates, cwd);
    return { rules, importAll: false };
  }

  clack.log.info(overlapMessage);

  const choice = await clack.select({
    message: "How would you like to import these?",
    options: [
      {
        value: "recommended",
        label: "Use recommended format as source",
        hint: "Multi-file format preferred, similar files backed up",
      },
      {
        value: "all",
        label: "Import all files separately",
        hint: "Keep all files as individual rules (may have duplicates)",
      },
    ],
  });

  if (clack.isCancel(choice)) {
    clack.cancel("Run 'aligntrue init' when you're ready to start.");
    process.exit(0);
    return { rules, importAll: false };
  }

  if (choice === "all") {
    const { scanForExistingRulesWithOverlap: rescan } =
      await import("./rule-importer.js");
    const allResult = await rescan(cwd, { detectOverlap: false });
    clack.log.info("Importing all files as separate rules.");
    return { rules: allResult.rules, importAll: true };
  }

  await backupDuplicateFiles(duplicates, cwd);
  clack.log.success(
    `Backed up ${duplicates.length} similar file${duplicates.length !== 1 ? "s" : ""} to .aligntrue/.backups/init-duplicates/`,
  );

  return { rules, importAll: false };
}

async function backupDuplicateFiles(
  duplicates: DuplicateFile[],
  cwd: string,
): Promise<void> {
  if (duplicates.length === 0) return;

  const paths = getAlignTruePaths(cwd);
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-")
    .replace(/Z$/, "");
  const backupDir = join(
    paths.aligntrueDir,
    ".backups",
    "init-duplicates",
    timestamp,
  );

  mkdirSync(backupDir, { recursive: true });

  for (const dup of duplicates) {
    const srcPath = dup.file.path;
    const destPath = join(backupDir, dup.file.relativePath);
    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(srcPath, destPath);
  }

  const manifest = {
    version: "1",
    timestamp: new Date().toISOString(),
    reason: "init-overlap-detection",
    duplicates: duplicates.map((d) => ({
      path: d.file.relativePath,
      type: d.file.type,
      similarity: d.similarity,
      canonicalPath: d.canonicalPath,
    })),
  };

  writeFileSync(
    join(backupDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}
