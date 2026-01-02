import { Identity } from "@aligntrue/core";
import { exitWithError } from "../../utils/command-utilities.js";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";
import { buildCommand, createLedger } from "./shared.js";

export async function createWork(args: string[]): Promise<void> {
  const spec: ArgDefinition[] = [
    { flag: "id", type: "string" },
    { flag: "desc", type: "string" },
    { flag: "description", type: "string" },
  ];

  const parsed = parseArgs(args, spec);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: "Usage: aligntrue work create <title> [--id <id>] [--desc <text>]",
    });
  }

  const title = parsed.positional[0];
  if (!title) {
    exitWithError(2, "Title is required", {
      hint: "Usage: aligntrue work create <title> [--id <id>] [--desc <text>]",
    });
  }

  const safeTitle: string = title;
  const work_id: string =
    (parsed.flags.id as string | undefined) ??
    Identity.deterministicId(safeTitle);
  const description =
    (parsed.flags.desc as string | undefined) ??
    (parsed.flags.description as string | undefined);
  const payload =
    description === undefined
      ? { work_id, title: safeTitle }
      : { work_id, title: safeTitle, description };
  const ledger = createLedger();
  const outcome = await ledger.execute(buildCommand("work.create", payload));

  console.log(
    `Work item ${work_id} created (${outcome.status}, events: ${outcome.produced_events?.length ?? 0})`,
  );
}
