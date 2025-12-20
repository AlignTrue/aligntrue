/**
 * Action safety class contracts (DR-013 PromptInjection, DR-018 incident controls).
 */
export enum SafetyClass {
  Read = "READ",
  WriteInternal = "WRITE_INTERNAL",
  WriteExternalSideEffect = "WRITE_EXTERNAL_SIDE_EFFECT",
}

export interface ActionIntent {
  name: string;
  description?: string;
  classification?: SafetyClass;
  allowedDestinations?: string[];
}

export interface ClassificationResult {
  safetyClass: SafetyClass;
  requiresApproval?: boolean;
  notes?: string;
}
