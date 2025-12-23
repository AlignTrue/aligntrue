import type { EmailAssessmentContent } from "./assessment.js";
import type { ThreadSlice } from "./thread-slice.js";

export const RISK_GATE_VERSION = "v1";

export interface RiskGateResult {
  allowed: boolean;
  blockedBy?: string[];
  risk_gate_version: string;
}

export interface KnownSenders {
  senders: Set<string>;
  domains: Set<string>;
}

interface RiskGateInput {
  assessment: EmailAssessmentContent;
  threadSlice: ThreadSlice;
  knownSenders?: KnownSenders;
}

function evaluateCommonGates(input: RiskGateInput): string[] {
  const blockers: string[] = [];
  const sender = normalizeEmail(
    input.threadSlice.recent_messages.at(-1)?.from ?? "",
  );

  if (sender && !input.knownSenders?.senders.has(sender)) {
    blockers.push("unknown_sender");
  }

  const domain = extractDomain(sender);
  if (domain && input.knownSenders?.domains.has(domain) === false) {
    // only block if we have known senders list and domain is not present
    blockers.push("unknown_domain");
  }

  if (input.threadSlice.has_attachments) {
    blockers.push("has_attachments");
  }

  const riskyKeywords = /invoice|contract|legal|payment|wire|tax|urgent|asap/i;
  if (riskyKeywords.test(input.threadSlice.subject)) {
    blockers.push("risky_keywords");
  }

  const lastMessageAt = Date.parse(input.threadSlice.last_message_at);
  const hoursSinceLastMessage = (Date.now() - lastMessageAt) / (1000 * 60 * 60);
  if (hoursSinceLastMessage < 24) {
    blockers.push("thread_active_last_24h");
  }

  return blockers;
}

export function evaluateAutoCommitGates(input: RiskGateInput): RiskGateResult {
  const blockers: string[] = [];

  if (input.assessment.classification !== "informational") {
    blockers.push("not_informational");
  }

  if (input.assessment.confidence < 0.9) {
    blockers.push("confidence_below_0.9");
  }

  blockers.push(...evaluateCommonGates(input));

  return {
    allowed: blockers.length === 0,
    ...(blockers.length ? { blockedBy: blockers } : {}),
    risk_gate_version: RISK_GATE_VERSION,
  };
}

export function evaluateDraftGates(input: RiskGateInput): RiskGateResult {
  const blockers: string[] = [];

  if (input.assessment.classification !== "simple_reply") {
    blockers.push("not_simple_reply");
  }

  if (input.assessment.confidence < 0.7) {
    blockers.push("confidence_below_0.7");
  }

  blockers.push(...evaluateCommonGates(input));

  const conflictLanguage =
    /disappointed|frustrated|angry|lawsuit|escalate|complaint/i;
  const allSnippets = input.threadSlice.recent_messages
    .map((m) => m.snippet)
    .join(" ");
  if (conflictLanguage.test(allSnippets)) {
    blockers.push("conflict_language_detected");
  }

  return {
    allowed: blockers.length === 0,
    ...(blockers.length ? { blockedBy: blockers } : {}),
    risk_gate_version: RISK_GATE_VERSION,
  };
}

function normalizeEmail(email: string): string {
  const match = email.match(/<([^>]+)>/) ?? [null, email];
  return (match[1] ?? email).toLowerCase().trim();
}

function extractDomain(email: string): string | undefined {
  const match = email.match(/@(.+)$/);
  return match?.[1];
}
