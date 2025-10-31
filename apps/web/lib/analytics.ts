/**
 * Analytics tracking for catalog website
 * Privacy-focused: no PII, optional tracking, client-side only
 */

import { AnalyticsEvent } from "./analytics-types";

// Session ID generation (client-side only, ephemeral)
let sessionId: string | undefined;

if (typeof window !== "undefined") {
  sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if analytics is enabled
 * Respects user privacy preferences and DNT header
 */
function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;

  // Check Do Not Track
  if (navigator.doNotTrack === "1") return false;

  // Check localStorage preference (user can opt-out)
  try {
    const preference = localStorage.getItem("aligntrue_analytics");
    if (preference === "disabled") return false;
  } catch {
    // localStorage access failed, default to disabled
    return false;
  }

  return true;
}

/**
 * Track an analytics event
 * Only logs to console in development, can be extended with real analytics
 */
export function trackEvent(
  event: Omit<AnalyticsEvent, "timestamp" | "sessionId">,
): void {
  if (!isAnalyticsEnabled()) return;

  const fullEvent: AnalyticsEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    sessionId,
  } as AnalyticsEvent;

  // Development: log to console
  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics]", fullEvent);
  }

  // Production: send to analytics endpoint (future implementation)
  // This would typically send to your analytics service
  // For now, we just prepare the event structure

  // Example future implementation:
  // fetch('/api/analytics', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(fullEvent),
  // }).catch(() => {
  //   // Fail silently
  // });
}

/**
 * Track catalog search
 */
export function trackCatalogSearch(query: string, resultCount: number): void {
  trackEvent({
    type: "catalog_search",
    query,
    resultCount,
  });
}

/**
 * Track catalog filter application
 */
export function trackCatalogFilter(
  filterType: "status" | "namespace" | "tag",
  value: string,
): void {
  trackEvent({
    type: "catalog_filter",
    filterType,
    value,
  });
}

/**
 * Track pack detail view
 */
export function trackDetailView(packSlug: string, version: string): void {
  trackEvent({
    type: "detail_view",
    packSlug,
    version,
  });
}

/**
 * Track exporter tab switch
 */
export function trackExporterTabSwitch(
  packSlug: string,
  toFormat: string,
  fromFormat?: string,
): void {
  trackEvent({
    type: "exporter_tab_switch",
    packSlug,
    fromFormat,
    toFormat,
  });
}

/**
 * Track install command copy
 */
export function trackCopyInstallCommand(
  packSlug: string,
  includesFromFlag: boolean = false,
): void {
  trackEvent({
    type: "copy_install_command",
    packSlug,
    includesFromFlag,
  });
}

/**
 * Track exporter preview copy
 */
export function trackCopyExporterPreview(
  packSlug: string,
  format: string,
): void {
  trackEvent({
    type: "copy_exporter_preview",
    packSlug,
    format,
  });
}

/**
 * Track YAML download
 */
export function trackDownloadYaml(packSlug: string): void {
  trackEvent({
    type: "download_yaml",
    packSlug,
  });
}

/**
 * Track share link copy
 */
export function trackShareLinkCopy(packSlug: string, url: string): void {
  trackEvent({
    type: "share_link_copy",
    packSlug,
    url,
  });
}

/**
 * Opt out of analytics tracking
 */
export function optOutAnalytics(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem("aligntrue_analytics", "disabled");
  } catch {
    // Fail silently
  }
}

/**
 * Opt in to analytics tracking
 */
export function optInAnalytics(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem("aligntrue_analytics", "enabled");
  } catch {
    // Fail silently
  }
}
