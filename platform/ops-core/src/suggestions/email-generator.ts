import {
  buildQueryArtifact,
  buildDerivedArtifact,
  type DerivedArtifact,
  type QueryArtifact,
} from "../artifacts/index.js";
import { generateStructuredOutput } from "../ai/index.js";
import { Identity } from "../identity/index.js";
import {
  buildSuggestionGeneratedEvent,
  type SuggestionGeneratedEvent,
} from "./events.js";
import {
  suggestionOutputType,
  type SuggestionContent,
  type SuggestionDiff,
  isSuggestionArtifact,
} from "./types.js";
import {
  emailClassificationSchema,
  buildEmailPrompt,
  buildEmailPromptWithBody,
  EMAIL_PROMPT_VERSION,
  type AIClassificationOutput,
} from "./schemas.js";
import {
  assessmentDedupeId,
  DEDUPE_RULES,
  type AssessmentDedupeKey,
  type SuggestionActiveKey,
  type SupersedeRecord,
} from "../emails/dedupe.js";
import {
  buildThreadSlice,
  buildEnrichedSlice,
  hashThreadSlice,
  needsFallbackFetch,
} from "../emails/thread-slice.js";
import { buildEmailAssessment } from "../emails/assessment.js";
import {
  evaluateAutoCommitGates,
  evaluateDraftGates,
} from "../emails/risk-gates.js";
import { CLASSIFICATION_ACTIONS } from "../emails/classification.js";
import type { SliceKind } from "../emails/types.js";
import type { EmailResolution } from "../emails/types.js";
import type { KnownSenders } from "../emails/risk-gates.js";
import type { ThreadsProjection } from "../projections/threads.js";
import type { KnownSendersProjection } from "../projections/known-senders.js";
import type { ActorRef } from "../envelopes/actor.js";
import type { ArtifactStore } from "../storage/interfaces.js";
import type { EmailAssessmentContent } from "../emails/assessment.js";
import { OPS_EMAIL_AUTO_COMMIT_ENABLED } from "../config.js";

export interface GmailBodyFetcher {
  fetchBodies(messageIds: string[]): Promise<Map<string, string>>;
}

export interface EmailSuggestionGeneratorInput {
  readonly artifactStore: ArtifactStore<QueryArtifact, DerivedArtifact>;
  readonly threads: ThreadsProjection;
  readonly knownSenders: KnownSendersProjection;
  readonly gmailFetcher: GmailBodyFetcher;
  readonly actor: ActorRef;
  readonly now?: string;
  readonly correlation_id?: string;
  readonly policy_version?: string;
  readonly modelVersion: string;
}

export interface SuggestionGeneratorResult {
  artifacts: DerivedArtifact[];
  events: SuggestionGeneratedEvent[];
  supersedes: SupersedeRecord[];
}

const POLICY_VERSION = "suggestions@email_triage@0.0.1";

export async function generateEmailSuggestions(
  input: EmailSuggestionGeneratorInput,
): Promise<SuggestionGeneratorResult> {
  const now = input.now ?? new Date().toISOString();
  const correlation_id = input.correlation_id ?? Identity.randomId();
  const policy_version = input.policy_version ?? POLICY_VERSION;

  const artifacts: DerivedArtifact[] = [];
  const events: SuggestionGeneratedEvent[] = [];
  const supersedes: SupersedeRecord[] = [];

  const supersededIds = await loadSupersededSuggestionIds(input.artifactStore);

  for (const thread of input.threads.threads) {
    const snippetSlice = buildThreadSlice(thread);
    let activeSlice:
      | ReturnType<typeof buildThreadSlice>
      | ReturnType<typeof buildEnrichedSlice> = snippetSlice;
    const snippetDedupeKey: AssessmentDedupeKey = {
      thread_id: thread.thread_id,
      slice_kind: "snippet",
      input_hash: hashThreadSlice(snippetSlice),
      prompt_version: EMAIL_PROMPT_VERSION,
      model_version: input.modelVersion,
    };

    let assessment: EmailAssessmentContent;
    let assessmentArtifact: DerivedArtifact;

    const existingSnippet = await input.artifactStore.getDerivedById(
      assessmentDedupeId(snippetDedupeKey),
    );
    if (existingSnippet && DEDUPE_RULES.skipAssessmentIfExists) {
      assessment = existingSnippet.output_data as EmailAssessmentContent;
      assessmentArtifact = existingSnippet;
    } else {
      const result = await generateStructuredOutput<AIClassificationOutput>({
        prompt: buildEmailPrompt(snippetSlice),
        schema: emailClassificationSchema,
      });
      assessment = buildEmailAssessment({
        threadSlice: snippetSlice,
        aiOutput: result.data,
        modelVersion: input.modelVersion,
        promptVersion: EMAIL_PROMPT_VERSION,
      });
      assessmentArtifact = buildDerivedArtifact({
        input_query_ids: [
          buildQueryArtifact({
            referenced_entities: ["email_thread"],
            referenced_fields: ["thread_id"],
            filters: { thread_id: thread.thread_id },
            created_at: now,
            created_by: input.actor,
            correlation_id,
          }).artifact_id,
        ],
        input_hashes: [assessment.input_hash],
        policy_version,
        output_type: "email_assessment",
        output_data: assessment,
        confidence: assessment.confidence,
        explanation: assessment.rationale,
        created_at: now,
        created_by: input.actor,
        correlation_id,
      });
      await input.artifactStore.putDerivedArtifact(assessmentArtifact);
      artifacts.push(assessmentArtifact);
    }

    if (needsFallbackFetch(assessment.classification, assessment.confidence)) {
      const bodies = await input.gmailFetcher.fetchBodies(
        snippetSlice.recent_messages.map((m) => m.message_id),
      );
      const enrichedSlice = buildEnrichedSlice(snippetSlice, bodies);
      activeSlice = enrichedSlice;
      const enrichedDedupeKey: AssessmentDedupeKey = {
        thread_id: thread.thread_id,
        slice_kind: "enriched",
        input_hash: hashThreadSlice(enrichedSlice),
        prompt_version: EMAIL_PROMPT_VERSION,
        model_version: input.modelVersion,
      };

      const existingEnriched = await input.artifactStore.getDerivedById(
        assessmentDedupeId(enrichedDedupeKey),
      );
      if (existingEnriched && DEDUPE_RULES.skipAssessmentIfExists) {
        const enrichedAssessment =
          existingEnriched.output_data as EmailAssessmentContent;
        if (enrichedAssessment.confidence > assessment.confidence) {
          assessment = enrichedAssessment;
          assessmentArtifact = existingEnriched;
          activeSlice = enrichedSlice;
        }
      } else {
        const enrichedResult =
          await generateStructuredOutput<AIClassificationOutput>({
            prompt: buildEmailPromptWithBody(enrichedSlice),
            schema: emailClassificationSchema,
          });
        const enrichedAssessment = buildEmailAssessment({
          threadSlice: enrichedSlice,
          aiOutput: enrichedResult.data,
          modelVersion: input.modelVersion,
          promptVersion: EMAIL_PROMPT_VERSION,
          fallbackFrom: { assessmentId: assessmentArtifact.artifact_id },
        });

        if (enrichedAssessment.confidence > assessment.confidence) {
          const enrichedArtifact = buildDerivedArtifact({
            input_query_ids: [
              buildQueryArtifact({
                referenced_entities: ["email_thread"],
                referenced_fields: ["thread_id"],
                filters: {
                  thread_id: thread.thread_id,
                  slice_kind: "enriched",
                },
                created_at: now,
                created_by: input.actor,
                correlation_id,
              }).artifact_id,
            ],
            input_hashes: [enrichedAssessment.input_hash],
            policy_version,
            output_type: "email_assessment",
            output_data: enrichedAssessment,
            confidence: enrichedAssessment.confidence,
            explanation: enrichedAssessment.rationale,
            created_at: now,
            created_by: input.actor,
            correlation_id,
          });
          await input.artifactStore.putDerivedArtifact(enrichedArtifact);
          artifacts.push(enrichedArtifact);
          assessment = enrichedAssessment;
          assessmentArtifact = enrichedArtifact;
          activeSlice = enrichedSlice;
        }
      }
    }

    const action = CLASSIFICATION_ACTIONS[assessment.classification];
    let to_status = action.suggestedStatus;
    // Seed resolution from suggestedResolution so processed transitions remain valid even when auto-commit is blocked.
    let resolution: EmailResolution | undefined = action.suggestedResolution;
    let trigger: "system" | "auto_commit" = "system";
    let reason = assessment.rationale;

    const knownSenders: KnownSenders = {
      senders: input.knownSenders.senders,
      domains: input.knownSenders.domains,
    };

    if (action.canAutoCommit && OPS_EMAIL_AUTO_COMMIT_ENABLED) {
      const auto = evaluateAutoCommitGates({
        assessment,
        threadSlice: activeSlice,
        knownSenders,
      });
      if (auto.allowed) {
        to_status = "processed";
        resolution = "archived";
        trigger = "auto_commit";
        reason = `${reason} | auto-commit: allowed`;
      } else {
        reason = `${reason} | auto-commit blocked: ${auto.blockedBy?.join(", ")}`;
      }
    }

    if (action.canAutoDraft) {
      const draft = evaluateDraftGates({
        assessment,
        threadSlice: activeSlice,
        knownSenders,
      });
      reason = draft.allowed
        ? `${reason} | draft allowed`
        : `${reason} | draft blocked: ${draft.blockedBy?.join(", ")}`;
    }

    const activeKey: SuggestionActiveKey = {
      thread_id: thread.thread_id,
      from_status: "inbox",
      to_status,
    };

    const activeSuggestion = await findActiveSuggestion(
      input.artifactStore,
      activeKey,
      supersededIds,
    );

    if (activeSuggestion) {
      const existingMeta = (activeSuggestion.output_data as SuggestionContent)
        .meta as { confidence?: number; assessment_id?: string };
      const shouldSupersede =
        DEDUPE_RULES.supersedeOnHigherConfidence &&
        (assessment.confidence ?? 0) >
          (existingMeta?.confidence ?? 0) +
            DEDUPE_RULES.confidenceThresholdForSupersede;
      if (!shouldSupersede) {
        continue;
      }
      const newSuggestion = await createSuggestion({
        artifactStore: input.artifactStore,
        assessment,
        assessmentArtifact,
        activeKey,
        actor: input.actor,
        now,
        correlation_id,
        policy_version,
        supersedes: activeSuggestion.artifact_id,
        trigger,
        ...(resolution ? { resolution } : {}),
        reason,
      });
      events.push(
        buildSuggestionGeneratedEvent({
          suggestion_id: newSuggestion.artifact_id,
          suggestion_type: "email_triage",
          target_refs: [assessment.source_ref],
          correlation_id,
          actor: input.actor,
          occurred_at: now,
        }),
      );
      artifacts.push(newSuggestion);
      const record: SupersedeRecord = {
        superseded_suggestion_id: activeSuggestion.artifact_id,
        superseded_by_suggestion_id: newSuggestion.artifact_id,
        superseded_at: now,
        reason: "higher_confidence",
        old_assessment_id: existingMeta?.assessment_id ?? "",
        new_assessment_id: assessmentArtifact.artifact_id,
        old_confidence: existingMeta?.confidence ?? 0,
        new_confidence: assessment.confidence ?? 0,
      };
      supersedes.push(record);
      supersededIds.add(activeSuggestion.artifact_id);
      continue;
    }

    const suggestion = await createSuggestion({
      artifactStore: input.artifactStore,
      assessment,
      assessmentArtifact,
      activeKey,
      actor: input.actor,
      now,
      correlation_id,
      policy_version,
      trigger,
      ...(resolution ? { resolution } : {}),
      reason,
    });
    artifacts.push(suggestion);
    events.push(
      buildSuggestionGeneratedEvent({
        suggestion_id: suggestion.artifact_id,
        suggestion_type: "email_triage",
        target_refs: [assessment.source_ref],
        correlation_id,
        actor: input.actor,
        occurred_at: now,
      }),
    );
  }

  return { artifacts, events, supersedes };
}

async function createSuggestion(opts: {
  artifactStore: ArtifactStore<QueryArtifact, DerivedArtifact>;
  assessment: EmailAssessmentContent;
  assessmentArtifact: DerivedArtifact;
  activeKey: SuggestionActiveKey;
  actor: ActorRef;
  now: string;
  correlation_id: string;
  policy_version: string;
  supersedes?: string;
  trigger: "system" | "auto_commit";
  resolution?: EmailResolution;
  reason: string;
}): Promise<DerivedArtifact> {
  const { assessment, assessmentArtifact } = opts;
  const diff: SuggestionDiff = {
    type: "email_triage",
    source_ref: assessment.source_ref,
    thread_id: assessment.thread_id,
    from_status: opts.activeKey.from_status,
    to_status: opts.activeKey.to_status,
    assessment_id: assessmentArtifact.artifact_id,
    slice_kind: assessment.slice_kind as SliceKind,
    reason: opts.reason,
  };

  const meta = {
    confidence: assessment.confidence,
    slice_kind: assessment.slice_kind,
    assessment_id: assessmentArtifact.artifact_id,
    ...(opts.supersedes
      ? { supersedes_suggestion_id: opts.supersedes, superseded_at: opts.now }
      : {}),
  };

  const content: SuggestionContent = {
    suggestion_type: "email_triage",
    target_refs: [assessment.source_ref],
    diff,
    rationale: opts.reason,
    confidence: assessment.confidence,
    meta,
  };

  const query = buildQueryArtifact({
    referenced_entities: ["email_thread"],
    referenced_fields: ["thread_id", "source_ref"],
    filters: {
      thread_id: assessment.thread_id,
      source_ref: assessment.source_ref,
      slice_kind: assessment.slice_kind,
    },
    created_at: opts.now,
    created_by: opts.actor,
    correlation_id: opts.correlation_id,
  });
  await opts.artifactStore.putQueryArtifact(query);

  const derived = buildDerivedArtifact({
    input_query_ids: [query.artifact_id],
    input_hashes: [assessment.input_hash],
    policy_version: opts.policy_version,
    output_type: suggestionOutputType("email_triage"),
    output_data: content,
    confidence: assessment.confidence,
    explanation: assessment.rationale,
    created_at: opts.now,
    created_by: opts.actor,
    correlation_id: opts.correlation_id,
  });

  await opts.artifactStore.putDerivedArtifact(derived);
  return derived;
}

async function findActiveSuggestion(
  store: ArtifactStore<QueryArtifact, DerivedArtifact>,
  key: SuggestionActiveKey,
  supersededIds: Set<string>,
): Promise<DerivedArtifact | null> {
  const all = await store.listDerivedArtifacts();
  for (const artifact of all) {
    if (!isSuggestionArtifact(artifact)) continue;
    if (artifact.output_type !== suggestionOutputType("email_triage")) continue;
    if (supersededIds.has(artifact.artifact_id)) continue;
    const content = artifact.output_data as SuggestionContent;
    const diff = content.diff;
    if (
      diff?.type === "email_triage" &&
      diff.thread_id === key.thread_id &&
      diff.from_status === key.from_status &&
      diff.to_status === key.to_status
    ) {
      return artifact;
    }
  }
  return null;
}

async function loadSupersededSuggestionIds(
  store: ArtifactStore<QueryArtifact, DerivedArtifact>,
): Promise<Set<string>> {
  const all = await store.listDerivedArtifacts();
  const superseded = new Set<string>();
  for (const artifact of all) {
    if (!isSuggestionArtifact(artifact)) continue;
    const meta = (artifact.output_data as SuggestionContent).meta as
      | { supersedes_suggestion_id?: string }
      | undefined;
    if (meta?.supersedes_suggestion_id) {
      superseded.add(meta.supersedes_suggestion_id);
    }
  }
  return superseded;
}
