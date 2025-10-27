import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readTelemetryState,
  writeTelemetryState,
  ensureUUID,
  rotateEvents,
  recordEvent,
  TelemetryState,
  TelemetryEvent,
} from '../../src/telemetry/collector.js';

const TEST_DIR = join(process.cwd(), 'test-telemetry-tmp');
const TEST_STATE_FILE = join(TEST_DIR, 'telemetry.json');
const TEST_EVENTS_FILE = join(TEST_DIR, 'telemetry-events.json');

describe('Telemetry Collector', () => {
  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('readTelemetryState', () => {
    it('returns default state when file does not exist', () => {
      const state = readTelemetryState(TEST_STATE_FILE);
      expect(state).toEqual({ enabled: false });
    });

    it('reads existing state file', () => {
      const expectedState: TelemetryState = { enabled: true, uuid: 'test-uuid-123' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(expectedState));

      const state = readTelemetryState(TEST_STATE_FILE);
      expect(state).toEqual(expectedState);
    });

    it('returns default state on invalid JSON', () => {
      writeFileSync(TEST_STATE_FILE, 'invalid json {');

      const state = readTelemetryState(TEST_STATE_FILE);
      expect(state).toEqual({ enabled: false });
    });
  });

  describe('writeTelemetryState', () => {
    it('creates directory if it does not exist', () => {
      const nestedPath = join(TEST_DIR, 'nested', 'dir', 'telemetry.json');
      const state: TelemetryState = { enabled: true };

      writeTelemetryState(state, nestedPath);

      expect(existsSync(nestedPath)).toBe(true);
    });

    it('writes state to file', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid-456' };

      writeTelemetryState(state, TEST_STATE_FILE);

      const content = readFileSync(TEST_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(state);
    });

    it('formats JSON with indentation', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid-789' };

      writeTelemetryState(state, TEST_STATE_FILE);

      const content = readFileSync(TEST_STATE_FILE, 'utf-8');
      expect(content).toContain('\n  ');
    });
  });

  describe('ensureUUID', () => {
    it('returns undefined when telemetry is disabled', () => {
      const state: TelemetryState = { enabled: false };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      const uuid = ensureUUID(TEST_STATE_FILE);

      expect(uuid).toBeUndefined();
    });

    it('generates UUID when enabled and no UUID exists', () => {
      const state: TelemetryState = { enabled: true };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      const uuid = ensureUUID(TEST_STATE_FILE);

      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid!.length).toBeGreaterThan(0);
    });

    it('returns existing UUID when already set', () => {
      const existingUUID = 'existing-uuid-123';
      const state: TelemetryState = { enabled: true, uuid: existingUUID };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      const uuid = ensureUUID(TEST_STATE_FILE);

      expect(uuid).toBe(existingUUID);
    });

    it('generates same UUID across multiple calls', () => {
      const state: TelemetryState = { enabled: true };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      const uuid1 = ensureUUID(TEST_STATE_FILE);
      const uuid2 = ensureUUID(TEST_STATE_FILE);
      const uuid3 = ensureUUID(TEST_STATE_FILE);

      expect(uuid1).toBe(uuid2);
      expect(uuid2).toBe(uuid3);
    });

    it('persists UUID to state file', () => {
      const state: TelemetryState = { enabled: true };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      ensureUUID(TEST_STATE_FILE);

      const updatedState = readTelemetryState(TEST_STATE_FILE);
      expect(updatedState.uuid).toBeDefined();
      expect(typeof updatedState.uuid).toBe('string');
    });

    it('returns undefined when state file does not exist', () => {
      const uuid = ensureUUID(TEST_STATE_FILE);

      expect(uuid).toBeUndefined();
    });
  });

  describe('rotateEvents', () => {
    it('does nothing when events file does not exist', () => {
      rotateEvents(TEST_EVENTS_FILE);

      expect(existsSync(TEST_EVENTS_FILE)).toBe(false);
    });

    it('does nothing when events are below threshold', () => {
      const events: TelemetryEvent[] = Array.from({ length: 500 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        uuid: 'test-uuid',
        command_name: `command-${i}`,
        align_hashes_used: [],
      }));
      writeFileSync(TEST_EVENTS_FILE, JSON.stringify(events));

      rotateEvents(TEST_EVENTS_FILE);

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.length).toBe(500);
    });

    it('keeps only last 1000 events when over threshold', () => {
      const events: TelemetryEvent[] = Array.from({ length: 1500 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        uuid: 'test-uuid',
        command_name: `command-${i}`,
        align_hashes_used: [],
      }));
      writeFileSync(TEST_EVENTS_FILE, JSON.stringify(events));

      rotateEvents(TEST_EVENTS_FILE);

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.length).toBe(1000);
      // Should keep the most recent ones (500-1499)
      expect(parsed[0].command_name).toBe('command-500');
      expect(parsed[999].command_name).toBe('command-1499');
    });

    it('handles exactly 1000 events without rotation', () => {
      const events: TelemetryEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        uuid: 'test-uuid',
        command_name: `command-${i}`,
        align_hashes_used: [],
      }));
      writeFileSync(TEST_EVENTS_FILE, JSON.stringify(events));

      rotateEvents(TEST_EVENTS_FILE);

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.length).toBe(1000);
    });

    it('handles 1001 events with rotation', () => {
      const events: TelemetryEvent[] = Array.from({ length: 1001 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        uuid: 'test-uuid',
        command_name: `command-${i}`,
        align_hashes_used: [],
      }));
      writeFileSync(TEST_EVENTS_FILE, JSON.stringify(events));

      rotateEvents(TEST_EVENTS_FILE);

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.length).toBe(1000);
      expect(parsed[0].command_name).toBe('command-1');
      expect(parsed[999].command_name).toBe('command-1000');
    });

    it('handles corrupted events file gracefully', () => {
      writeFileSync(TEST_EVENTS_FILE, 'invalid json [');

      rotateEvents(TEST_EVENTS_FILE);

      // Should not throw, and file should be cleaned up or left as-is
      expect(existsSync(TEST_EVENTS_FILE)).toBe(true);
    });
  });

  describe('recordEvent', () => {
    it('does not record when telemetry is disabled', () => {
      const state: TelemetryState = { enabled: false };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      recordEvent(
        { command_name: 'test-command', align_hashes_used: [] },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );

      expect(existsSync(TEST_EVENTS_FILE)).toBe(false);
    });

    it('records event when telemetry is enabled', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid-record' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      recordEvent(
        {
          command_name: 'init',
          export_target: undefined,
          align_hashes_used: [],
        },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );

      expect(existsSync(TEST_EVENTS_FILE)).toBe(true);
      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const events = JSON.parse(content);
      expect(events.length).toBe(1);
      expect(events[0].command_name).toBe('init');
      expect(events[0].uuid).toBe('test-uuid-record');
    });

    it('includes timestamp in ISO 8601 format', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      recordEvent(
        { command_name: 'test', align_hashes_used: [] },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const events = JSON.parse(content);
      expect(events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('includes export_target when provided', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      recordEvent(
        {
          command_name: 'sync',
          export_target: 'cursor,agents-md',
          align_hashes_used: [],
        },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const events = JSON.parse(content);
      expect(events[0].export_target).toBe('cursor,agents-md');
    });

    it('includes align_hashes_used array', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      recordEvent(
        {
          command_name: 'sync',
          align_hashes_used: ['abc123', 'def456'],
        },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const events = JSON.parse(content);
      expect(events[0].align_hashes_used).toEqual(['abc123', 'def456']);
    });

    it('appends to existing events', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      recordEvent(
        { command_name: 'init', align_hashes_used: [] },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );
      recordEvent(
        { command_name: 'sync', align_hashes_used: [] },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );
      recordEvent(
        { command_name: 'team-enable', align_hashes_used: [] },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const events = JSON.parse(content);
      expect(events.length).toBe(3);
      expect(events[0].command_name).toBe('init');
      expect(events[1].command_name).toBe('sync');
      expect(events[2].command_name).toBe('team-enable');
    });

    it('applies rotation automatically after recording', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      // Pre-populate with 1000 events
      const existingEvents: TelemetryEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        uuid: 'test-uuid',
        command_name: `command-${i}`,
        align_hashes_used: [],
      }));
      writeFileSync(TEST_EVENTS_FILE, JSON.stringify(existingEvents));

      // Record one more event
      recordEvent(
        { command_name: 'new-command', align_hashes_used: [] },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const events = JSON.parse(content);
      expect(events.length).toBe(1000); // Should have rotated
      expect(events[0].command_name).toBe('command-1'); // First old event removed
      expect(events[999].command_name).toBe('new-command'); // New event at end
    });

    it('generates UUID if not present when recording', () => {
      const state: TelemetryState = { enabled: true };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      recordEvent(
        { command_name: 'test', align_hashes_used: [] },
        TEST_STATE_FILE,
        TEST_EVENTS_FILE
      );

      const updatedState = readTelemetryState(TEST_STATE_FILE);
      expect(updatedState.uuid).toBeDefined();

      const content = readFileSync(TEST_EVENTS_FILE, 'utf-8');
      const events = JSON.parse(content);
      expect(events[0].uuid).toBe(updatedState.uuid);
    });
  });

  describe('Privacy validation', () => {
    it('rejects command_name with file paths', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      expect(() => {
        recordEvent(
          {
            command_name: '/path/to/command',
            align_hashes_used: [],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).toThrow(/Privacy violation/);
    });

    it('rejects command_name with Windows paths', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      expect(() => {
        recordEvent(
          {
            command_name: 'C:\\Users\\test',
            align_hashes_used: [],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).toThrow(/Privacy violation/);
    });

    it('rejects export_target with file paths', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      expect(() => {
        recordEvent(
          {
            command_name: 'sync',
            export_target: '/path/to/file',
            align_hashes_used: [],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).toThrow(/Privacy violation/);
    });

    it('rejects align_hashes_used with code snippets', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      expect(() => {
        recordEvent(
          {
            command_name: 'sync',
            align_hashes_used: ['const foo = "bar"'],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).toThrow(/Privacy violation/);
    });

    it('rejects align_hashes_used with suspiciously long strings', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      expect(() => {
        recordEvent(
          {
            command_name: 'sync',
            align_hashes_used: ['a'.repeat(300)],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).toThrow(/Privacy violation/);
    });

    it('accepts valid command names', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      expect(() => {
        recordEvent(
          {
            command_name: 'init',
            align_hashes_used: [],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).not.toThrow();

      expect(() => {
        recordEvent(
          {
            command_name: 'sync',
            align_hashes_used: [],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).not.toThrow();

      expect(() => {
        recordEvent(
          {
            command_name: 'team-enable',
            align_hashes_used: [],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).not.toThrow();
    });

    it('accepts valid export targets', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      expect(() => {
        recordEvent(
          {
            command_name: 'sync',
            export_target: 'cursor',
            align_hashes_used: [],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).not.toThrow();

      expect(() => {
        recordEvent(
          {
            command_name: 'sync',
            export_target: 'cursor,agents-md,vscode-mcp',
            align_hashes_used: [],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).not.toThrow();
    });

    it('accepts valid hash strings', () => {
      const state: TelemetryState = { enabled: true, uuid: 'test-uuid' };
      writeFileSync(TEST_STATE_FILE, JSON.stringify(state));

      expect(() => {
        recordEvent(
          {
            command_name: 'sync',
            align_hashes_used: [
              'abc123',
              'def456',
              '9a7b8c6d5e4f3a2b1c0d9e8f7a6b5c4d',
            ],
          },
          TEST_STATE_FILE,
          TEST_EVENTS_FILE
        );
      }).not.toThrow();
    });
  });
});

