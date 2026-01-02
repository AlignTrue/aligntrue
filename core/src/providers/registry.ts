import type { CalendarProvider } from "./calendar.js";
import type { EmailProvider } from "./email.js";
import { ValidationError } from "../errors.js";

export type ProviderKind = "calendar" | "email";

const calendarRegistry = new Map<string, CalendarProvider>();
const emailRegistry = new Map<string, EmailProvider>();

export function registerCalendarProvider(
  name: string,
  provider: CalendarProvider,
): void {
  calendarRegistry.set(name, provider);
}

export function registerEmailProvider(
  name: string,
  provider: EmailProvider,
): void {
  emailRegistry.set(name, provider);
}

export function getCalendarProvider(name: string): CalendarProvider {
  const provider = calendarRegistry.get(name);
  if (!provider) {
    const available =
      listProviders("calendar").join(", ") || "(none registered)";
    throw new ValidationError(`Unknown calendar provider "${name}"`, {
      name,
      available,
    });
  }
  return provider;
}

export function getEmailProvider(name: string): EmailProvider {
  const provider = emailRegistry.get(name);
  if (!provider) {
    const available = listProviders("email").join(", ") || "(none registered)";
    throw new ValidationError(`Unknown email provider "${name}"`, {
      name,
      available,
    });
  }
  return provider;
}

export function listProviders(kind: ProviderKind): string[] {
  const registry = kind === "calendar" ? calendarRegistry : emailRegistry;
  return Array.from(registry.keys());
}
