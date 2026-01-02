export interface ConversionMeta {
  /**
   * Source system of the original message (email, slack, intercom, text, etc.).
   * Keep this extensible for future sources.
   */
  from_source_type: string;
  /**
   * Canonical reference to the original message (e.g., source_ref or provider id hash).
   */
  from_source_ref: string;
  /**
   * How the conversion was initiated (user action, accepted suggestion, rule trigger).
   */
  conversion_method:
    | "user_action"
    | "ai_suggestion_accepted"
    | "rule_triggered";
  /**
   * Timestamp when conversion occurred.
   */
  converted_at: string;
}
