import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AtomicFileWriter } from '../sync/file-operations.js';

/**
 * Telemetry event structure
 */
export interface TelemetryEvent {
  timestamp: string;
  uuid: string;
  command_name: string;
  export_target?: string;
  align_hashes_used: string[];
}

/**
 * Telemetry state stored in .aligntrue/telemetry.json
 */
export interface TelemetryState {
  enabled: boolean;
  uuid?: string;
}

/**
 * Maximum number of events to keep in rotation
 */
const MAX_EVENTS = 1000;

/**
 * Default telemetry state file location (relative to project root)
 */
const DEFAULT_STATE_FILE = '.aligntrue/telemetry.json';

/**
 * Default events file location (relative to project root)
 */
const DEFAULT_EVENTS_FILE = '.aligntrue/telemetry-events.json';

/**
 * Privacy validation: Reject events that contain potential PII
 * This is a basic check - in practice, command implementations should never pass such data
 */
function validatePrivacy(event: Partial<TelemetryEvent>): void {
  const sensitivePatterns = [
    /[\/\\]/, // File paths (contains slashes or backslashes)
    /\.git/, // Git paths
    /node_modules/,
    /Users\//,
    /home\//,
    /C:\\/,
    /\bfunction\b/, // Code snippets
    /\bconst\b/,
    /\blet\b/,
    /\bvar\b/,
  ];

  const checkString = (value: string, fieldName: string): void => {
    for (const pattern of sensitivePatterns) {
      if (pattern.test(value)) {
        throw new Error(
          `Privacy violation: ${fieldName} appears to contain sensitive data (paths/code). Pattern matched: ${pattern}`
        );
      }
    }
  };

  if (event.command_name) {
    checkString(event.command_name, 'command_name');
  }

  if (event.export_target) {
    checkString(event.export_target, 'export_target');
  }

  // Hash validation: should be hex strings, not paths or code
  if (event.align_hashes_used) {
    for (const hash of event.align_hashes_used) {
      if (hash.length > 256) {
        // Hashes shouldn't be this long
        throw new Error(
          'Privacy violation: align_hashes_used contains suspiciously long strings'
        );
      }
      checkString(hash, 'align_hashes_used');
    }
  }
}

/**
 * Read telemetry state from file
 */
export function readTelemetryState(
  stateFilePath: string = DEFAULT_STATE_FILE
): TelemetryState {
  if (!existsSync(stateFilePath)) {
    return { enabled: false };
  }

  try {
    const content = readFileSync(stateFilePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { enabled: false };
  }
}

/**
 * Write telemetry state to file
 */
export function writeTelemetryState(
  state: TelemetryState,
  stateFilePath: string = DEFAULT_STATE_FILE
): void {
  const dir = dirname(stateFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const writer = new AtomicFileWriter();
  writer.write(stateFilePath, JSON.stringify(state, null, 2));
}

/**
 * Ensure UUID exists in telemetry state
 * Generates a new UUID if telemetry is enabled and no UUID exists
 * Returns the UUID if telemetry is enabled, undefined otherwise
 */
export function ensureUUID(
  stateFilePath: string = DEFAULT_STATE_FILE
): string | undefined {
  const state = readTelemetryState(stateFilePath);

  if (!state.enabled) {
    return undefined;
  }

  if (!state.uuid) {
    state.uuid = randomUUID();
    writeTelemetryState(state, stateFilePath);
  }

  return state.uuid;
}

/**
 * Read events from events file
 */
function readEvents(eventsFilePath: string = DEFAULT_EVENTS_FILE): TelemetryEvent[] {
  if (!existsSync(eventsFilePath)) {
    return [];
  }

  try {
    const content = readFileSync(eventsFilePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Write events to events file with atomic writes
 */
function writeEvents(
  events: TelemetryEvent[],
  eventsFilePath: string = DEFAULT_EVENTS_FILE
): void {
  const dir = dirname(eventsFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const writer = new AtomicFileWriter();
  writer.write(eventsFilePath, JSON.stringify(events, null, 2));
}

/**
 * Rotate events to keep only the most recent MAX_EVENTS entries
 */
export function rotateEvents(eventsFilePath: string = DEFAULT_EVENTS_FILE): void {
  const events = readEvents(eventsFilePath);

  if (events.length > MAX_EVENTS) {
    // Keep only the last MAX_EVENTS
    const rotated = events.slice(-MAX_EVENTS);
    writeEvents(rotated, eventsFilePath);
  }
}

/**
 * Record a telemetry event
 * Only records if telemetry is enabled
 * Automatically applies rotation after recording
 */
export function recordEvent(
  eventData: Omit<TelemetryEvent, 'timestamp' | 'uuid'>,
  stateFilePath: string = DEFAULT_STATE_FILE,
  eventsFilePath: string = DEFAULT_EVENTS_FILE
): void {
  const state = readTelemetryState(stateFilePath);

  if (!state.enabled) {
    return; // Silently skip if telemetry is disabled
  }

  // Ensure UUID exists
  const uuid = ensureUUID(stateFilePath);
  if (!uuid) {
    return; // Should not happen if enabled, but safety check
  }

  // Privacy validation
  validatePrivacy(eventData);

  // Create full event
  const event: TelemetryEvent = {
    timestamp: new Date().toISOString(),
    uuid,
    command_name: eventData.command_name,
    ...(eventData.export_target !== undefined && { export_target: eventData.export_target }),
    align_hashes_used: eventData.align_hashes_used,
  };

  // Read existing events
  const events = readEvents(eventsFilePath);

  // Append new event
  events.push(event);

  // Write back
  writeEvents(events, eventsFilePath);

  // Apply rotation
  rotateEvents(eventsFilePath);
}

