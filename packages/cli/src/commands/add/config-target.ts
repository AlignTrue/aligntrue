import * as clack from "@clack/prompts";
import { getAlignTruePaths, isTeamModeActive } from "@aligntrue/core";
import { exitWithError } from "../../utils/error-formatter.js";
import { isTTY } from "../../utils/tty-helper.js";

export async function determineTargetConfig(options: {
  cwd: string;
  configPath: string;
  personal: boolean;
  shared: boolean;
  operationType: "link" | "remote";
}): Promise<{ targetPath: string; isPersonalConfig: boolean }> {
  const { cwd, configPath, personal, shared, operationType } = options;
  const paths = getAlignTruePaths(cwd);

  if (!isTeamModeActive(cwd)) {
    return { targetPath: configPath, isPersonalConfig: true };
  }

  if (personal) {
    return { targetPath: paths.config, isPersonalConfig: true };
  }
  if (shared) {
    return { targetPath: paths.teamConfig, isPersonalConfig: false };
  }

  if (isTTY()) {
    const choice = await clack.select({
      message: `Add ${operationType} to which config?`,
      options: [
        {
          value: "personal",
          label: "Personal config (gitignored, for your use only)",
          hint: "config.yaml",
        },
        {
          value: "team",
          label: "Team config (committed, shared with team)",
          hint: "config.team.yaml",
        },
      ],
      initialValue: operationType === "remote" ? "personal" : "team",
    });

    if (clack.isCancel(choice)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    if (choice === "personal") {
      return { targetPath: paths.config, isPersonalConfig: true };
    } else {
      return { targetPath: paths.teamConfig, isPersonalConfig: false };
    }
  }

  const hintMessage =
    operationType === "link"
      ? `Use --personal for personal config, or edit config.team.yaml directly for shared links`
      : `Use: aligntrue add ${operationType} <url> --personal (or --shared)`;

  exitWithError(
    {
      title: "Ambiguous target config",
      message: `In team mode, specify target config for add ${operationType}`,
      hint: hintMessage,
      code: "AMBIGUOUS_CONFIG_TARGET",
    },
    2,
  );

  return { targetPath: configPath, isPersonalConfig: true };
}
