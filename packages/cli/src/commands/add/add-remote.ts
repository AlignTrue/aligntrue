import * as clack from "@clack/prompts";
import { existsSync } from "fs";
import { saveConfig, type AlignTrueConfig } from "@aligntrue/core";
import { loadConfigWithValidation } from "../../utils/config-loader.js";
import { exitWithError } from "../../utils/error-formatter.js";
import { isTTY } from "../../utils/tty-helper.js";
import type { createManagedSpinner } from "../../utils/spinner.js";
import { determineTargetConfig } from "./config-target.js";

export async function addRemote(options: {
  baseUrl: string;
  gitRef?: string | undefined;
  configPath: string;
  scope?: "personal" | "shared" | undefined;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const { baseUrl, gitRef, configPath, scope, spinner } = options;

  const cwd = process.cwd();

  const { targetPath } = await determineTargetConfig({
    cwd,
    configPath,
    personal: scope === "personal" || scope === undefined,
    shared: scope === "shared",
    operationType: "remote",
  });

  const remoteKey = scope || "personal";

  spinner.start("Adding remote...");

  try {
    let config: AlignTrueConfig;

    if (existsSync(targetPath)) {
      config = await loadConfigWithValidation(targetPath);
    } else {
      config = {
        version: undefined,
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
    }

    if (!config.remotes) {
      config.remotes = {};
    }

    const remoteUrl = gitRef ? { url: baseUrl, branch: gitRef } : baseUrl;

    const existingRemote = config.remotes[remoteKey as "personal" | "shared"];
    if (existingRemote && !Array.isArray(existingRemote)) {
      const existingUrl =
        typeof existingRemote === "string"
          ? existingRemote
          : existingRemote.url;

      const isSameUrl =
        existingUrl === baseUrl ||
        (typeof remoteUrl === "string" && existingUrl === remoteUrl) ||
        (typeof remoteUrl === "object" && existingUrl === remoteUrl.url);

      if (isSameUrl) {
        spinner.stop("Remote already configured", 1);

        if (isTTY()) {
          clack.log.warn(
            `remotes.${remoteKey} is already configured:\n  ${existingUrl}`,
          );
          clack.log.info(
            `To update it, edit ${targetPath} directly or remove and re-add.`,
          );
        } else {
          console.log(
            `\nWarning: remotes.${remoteKey} already configured: ${existingUrl}`,
          );
        }
        return;
      }

      spinner.stop("Remote slot in use");

      if (isTTY()) {
        clack.log.warn(
          `remotes.${remoteKey} is already configured with a different URL:\n` +
            `  Current: ${existingUrl}\n` +
            `  New: ${baseUrl}`,
        );

        const confirm = await clack.confirm({
          message: `Replace existing remotes.${remoteKey}?`,
          initialValue: false,
        });

        if (clack.isCancel(confirm) || !confirm) {
          clack.cancel("Remote not added");
          return;
        }

        spinner.start("Updating remote...");
      } else {
        console.log(
          `\nWarning: Replacing existing remotes.${remoteKey}: ${existingUrl}`,
        );
      }
    }

    config.remotes[remoteKey as "personal" | "shared"] = remoteUrl;

    await saveConfig(config, targetPath);

    spinner.stop("Remote added");

    if (isTTY()) {
      clack.outro(`Remote added to remotes.${remoteKey}`);
    }
  } catch (error) {
    spinner.stopSilent();

    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    exitWithError({
      title: "Add remote failed",
      message: `Failed to add remote: ${error instanceof Error ? error.message : String(error)}`,
      hint: "Check the URL format and try again.",
      code: "ADD_REMOTE_FAILED",
    });
  }
}
