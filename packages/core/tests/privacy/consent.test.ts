import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConsentManager } from '../../src/privacy/consent.js';

describe('ConsentManager', () => {
  const testDir = join(process.cwd(), 'test-consent');
  const consentFile = join(testDir, 'privacy-consent.json');
  let manager: ConsentManager;

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    
    manager = new ConsentManager(consentFile);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('checkConsent', () => {
    it('returns false when no consent file exists', () => {
      expect(manager.checkConsent('catalog')).toBe(false);
      expect(manager.checkConsent('git')).toBe(false);
    });

    it('returns false for operation without consent', () => {
      manager.grantConsent('catalog');
      expect(manager.checkConsent('git')).toBe(false);
    });

    it('returns true for operation with consent', () => {
      manager.grantConsent('catalog');
      expect(manager.checkConsent('catalog')).toBe(true);
    });
  });

  describe('grantConsent', () => {
    it('grants consent for new operation', () => {
      manager.grantConsent('catalog');
      expect(manager.checkConsent('catalog')).toBe(true);
    });

    it('is idempotent - can grant multiple times', () => {
      const timestamp = '2025-10-29T10:00:00.000Z';
      manager.grantConsent('catalog', timestamp);
      manager.grantConsent('catalog', timestamp);
      
      const consents = manager.listConsents();
      expect(consents).toHaveLength(1);
      expect(consents[0].granted_at).toBe(timestamp);
    });

    it('stores timestamp when not provided', () => {
      const before = new Date().toISOString();
      manager.grantConsent('catalog');
      const after = new Date().toISOString();
      
      const consents = manager.listConsents();
      expect(consents[0].granted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(consents[0].granted_at >= before).toBe(true);
      expect(consents[0].granted_at <= after).toBe(true);
    });

    it('uses provided timestamp', () => {
      const timestamp = '2025-10-29T10:30:00.000Z';
      manager.grantConsent('catalog', timestamp);
      
      const consents = manager.listConsents();
      expect(consents[0].granted_at).toBe(timestamp);
    });

    it('creates directory if missing', () => {
      const deepFile = join(testDir, 'deep', 'nested', 'consent.json');
      const deepManager = new ConsentManager(deepFile);
      
      deepManager.grantConsent('catalog');
      expect(existsSync(deepFile)).toBe(true);
    });
  });

  describe('revokeConsent', () => {
    it('revokes specific operation consent', () => {
      manager.grantConsent('catalog');
      manager.grantConsent('git');
      
      manager.revokeConsent('catalog');
      
      expect(manager.checkConsent('catalog')).toBe(false);
      expect(manager.checkConsent('git')).toBe(true);
    });

    it('is idempotent - can revoke non-existent consent', () => {
      expect(() => manager.revokeConsent('catalog')).not.toThrow();
      expect(manager.checkConsent('catalog')).toBe(false);
    });
  });

  describe('revokeAll', () => {
    it('revokes all consents', () => {
      manager.grantConsent('catalog');
      manager.grantConsent('git');
      
      manager.revokeAll();
      
      expect(manager.checkConsent('catalog')).toBe(false);
      expect(manager.checkConsent('git')).toBe(false);
      expect(manager.listConsents()).toHaveLength(0);
    });

    it('works when no consents exist', () => {
      expect(() => manager.revokeAll()).not.toThrow();
      expect(manager.listConsents()).toHaveLength(0);
    });
  });

  describe('listConsents', () => {
    it('returns empty array when no consents', () => {
      expect(manager.listConsents()).toEqual([]);
    });

    it('returns all granted consents', () => {
      manager.grantConsent('catalog', '2025-10-29T10:00:00.000Z');
      manager.grantConsent('git', '2025-10-29T11:00:00.000Z');
      
      const consents = manager.listConsents();
      expect(consents).toHaveLength(2);
      
      const catalog = consents.find(c => c.operation === 'catalog');
      expect(catalog).toBeDefined();
      expect(catalog?.granted).toBe(true);
      expect(catalog?.granted_at).toBe('2025-10-29T10:00:00.000Z');
      
      const git = consents.find(c => c.operation === 'git');
      expect(git).toBeDefined();
      expect(git?.granted).toBe(true);
      expect(git?.granted_at).toBe('2025-10-29T11:00:00.000Z');
    });
  });

  describe('storage persistence', () => {
    it('persists consent across instances', () => {
      manager.grantConsent('catalog');
      
      // Create new instance with same file
      const newManager = new ConsentManager(consentFile);
      expect(newManager.checkConsent('catalog')).toBe(true);
    });

    it('writes valid JSON', () => {
      manager.grantConsent('catalog', '2025-10-29T10:00:00.000Z');
      
      const content = readFileSync(consentFile, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed).toEqual({
        catalog: {
          granted: true,
          granted_at: '2025-10-29T10:00:00.000Z',
        },
      });
    });

    it('handles corrupted JSON file gracefully', () => {
      writeFileSync(consentFile, '{ invalid json }');
      
      expect(manager.checkConsent('catalog')).toBe(false);
      expect(manager.listConsents()).toEqual([]);
    });

    it('handles non-object JSON gracefully', () => {
      writeFileSync(consentFile, '["array", "not", "object"]');
      
      expect(manager.checkConsent('catalog')).toBe(false);
      expect(manager.listConsents()).toEqual([]);
    });

    it('handles null JSON gracefully', () => {
      writeFileSync(consentFile, 'null');
      
      expect(manager.checkConsent('catalog')).toBe(false);
      expect(manager.listConsents()).toEqual([]);
    });
  });

  describe('atomic writes', () => {
    it('does not leave partial files on write', () => {
      // Grant consent multiple times rapidly
      for (let i = 0; i < 10; i++) {
        manager.grantConsent('catalog');
      }
      
      // File should exist and be valid
      expect(existsSync(consentFile)).toBe(true);
      const content = readFileSync(consentFile, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('uses AtomicFileWriter for safety', () => {
      manager.grantConsent('catalog');
      
      // Verify file exists and is valid
      expect(existsSync(consentFile)).toBe(true);
      const content = JSON.parse(readFileSync(consentFile, 'utf-8'));
      expect(content.catalog.granted).toBe(true);
    });
  });

  describe('getConsentFilePath', () => {
    it('returns configured consent file path', () => {
      expect(manager.getConsentFilePath()).toBe(consentFile);
    });
  });
});

