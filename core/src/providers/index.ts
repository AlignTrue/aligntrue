export type { CalendarProvider, CalendarFetchOpts } from "./calendar.js";
export type {
  EmailProvider,
  EmailFetchOpts,
  EmailBodyFetchOpts,
} from "./email.js";
export { createBodyFetcher } from "./email.js";
export {
  registerCalendarProvider,
  registerEmailProvider,
  getCalendarProvider,
  getEmailProvider,
  listProviders,
  type ProviderKind,
} from "./registry.js";
