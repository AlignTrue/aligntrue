import { exitWithError } from "../../utils/command-utilities.js";
import { syncCalendar } from "./calendar.js";
import { syncGmail } from "./gmail.js";

export async function sync(args: string[]): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case "calendar":
      return syncCalendar(args.slice(1));
    case "gmail":
      return syncGmail(args.slice(1));
    case "all":
      await syncCalendar(
        args
          .filter((a) => a.startsWith("--calendar-"))
          .map((a) => a.replace("--calendar-", "--")),
      );
      await syncGmail(
        args
          .filter((a) => a.startsWith("--gmail-"))
          .map((a) => a.replace("--gmail-", "--")),
      );
      return;
    default:
      return exitWithError(
        2,
        "Usage: aligntrue sync calendar [--days=N] | gmail [--days=N] | all [--calendar-days=N] [--gmail-days=N]",
      );
  }
}
