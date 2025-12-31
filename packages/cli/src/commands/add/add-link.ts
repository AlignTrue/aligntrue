import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import * as clack from "@clack/prompts";
import { patchConfig, saveConfig, type AlignTrueConfig } from "@aligntrue/core";
import { loadConfigWithValidation } from "../../utils/config-loader.js";
import { exitWithError } from "../../utils/error-formatter.js";
import { isTTY } from "../../utils/tty-helper.js";
import type { createManagedSpinner } from "../../utils/spinner.js";
import { determineTargetConfig } from "./config-target.js";

export async function addLink(options: {
  baseUrl: string;
  sourceType: "git" | "local";
  gitRef?: string | undefined;
  gitPath?: string | undefined;
  configPath: string;
  privateSource: boolean;
  personal: boolean;
  noSync: boolean;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const {
    baseUrl,
    sourceType,
    gitRef,
    gitPath,
    configPath,
    privateSource,
    personal,
    noSync,
    spinner,
  } = options;

  if (sourceType === "local") {
    const looksLikeExplicitPath =
      baseUrl.startsWith("./") ||
      baseUrl.startsWith("../") ||
      baseUrl.startsWith("/");

    if (!looksLikeExplicitPath) {
      exitWithError(
        {
          title: "Invalid URL for add link",
          message: `"${baseUrl}" is not a recognized git URL.`,
          hint: [
            "Supported formats for 'add link':",
            "  • GitHub/GitLab: https://github.com/org/repo",
            "  • SSH: git@github.com:org/repo.git",
            "",
            "For local paths, use 'add link ./path' with a leading './', '../', or '/'",
            "Or copy rules directly: 'aligntrue add ./local-rules'",
          ].join("\n"),
          code: "INVALID_LINK_URL",
        },
        2,
      );
    }
  }

  const cwd = process.cwd();
  const { targetPath, isPersonalConfig } = await determineTargetConfig({
    cwd,
    configPath,
    personal,
    shared: false,
    operationType: "link",
  });

  spinner.start("Adding align link...");

  let config: AlignTrueConfig;
  const targetExists = existsSync(targetPath);
  if (targetExists) {
    config = await loadConfigWithValidation(targetPath);
  } else {
    config = {
      version: undefined,
      mode: "solo",
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      exporters: ["agents"],
    };
    mkdirSync(dirname(targetPath), { recursive: true });
    await saveConfig(config, targetPath);
  }

  const sources: NonNullable<AlignTrueConfig["sources"]> = config.sources ?? [];

  type SourceEntry = NonNullable<AlignTrueConfig["sources"]>[number];
  const newSource: SourceEntry =
    sourceType === "git"
      ? {
          type: "git",
          url: baseUrl,
          ...(gitRef ? { ref: gitRef } : {}),
          ...(gitPath ? { path: gitPath } : {}),
          ...(personal || isPersonalConfig ? { personal: true } : {}),
          ...(privateSource || personal ? { gitignore: true } : {}),
        }
      : {
          type: "local",
          path: baseUrl,
        };

  const exists = sources.some((source) => {
    if (source.type !== newSource.type) return false;
    if (source.type === "git" && newSource.type === "git") {
      return (
        source.url === newSource.url &&
        (source.ref ?? "") === (newSource.ref ?? "") &&
        (source.path ?? "") === (newSource.path ?? "")
      );
    }
    if (source.type === "local" && newSource.type === "local") {
      return source.path === newSource.path;
    }
    return false;
  });

  if (exists) {
    spinner.stop("Link already exists", 1);
    if (isTTY()) {
      clack.log.info("Link already exists in configuration.");
    }
    return;
  }

  const updatedSources = [...sources, newSource];
  await patchConfig({ sources: updatedSources }, targetPath);

  spinner.stop("Align link added");

  let syncPerformed = false;
  if (!noSync) {
    try {
      if (isTTY()) {
        clack.log.step("Syncing rules to agents...");
      }
      const { sync } = await import("../sync/index.js");
      await sync(["--quiet"]);
      syncPerformed = true;
      if (isTTY()) {
        clack.log.success("Synced to agents");
      }
    } catch {
      if (isTTY()) {
        clack.log.warn("Auto-sync failed. Run 'aligntrue sync' manually.");
      } else {
        console.log(
          "\nWarning: Auto-sync failed. Run 'aligntrue sync' manually.",
        );
      }
    }
  }

  const outroMessage = syncPerformed
    ? `Added link: ${baseUrl}\nSynced to agents.`
    : `Added link: ${baseUrl}${noSync ? "" : "\nRun 'aligntrue sync' to pull updates."}`;
  if (isTTY()) {
    clack.outro(outroMessage);
  } else {
    console.log("\n" + outroMessage);
  }
}
