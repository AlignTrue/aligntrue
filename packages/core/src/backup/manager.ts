/**
 * Backup manager for AlignTrue configuration and rules
 * 
 * Handles creating, restoring, listing, and cleaning up backups
 * of the .aligntrue/ directory.
 */

import { join, relative, dirname } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, cpSync, statSync } from 'fs';
import type { BackupMetadata, BackupManifest, BackupInfo, BackupOptions, RestoreOptions, CleanupOptions } from './types';

const BACKUP_VERSION = '1';

export class BackupManager {
  /**
   * Create a backup of the .aligntrue/ directory
   */
  static createBackup(options: BackupOptions = {}): BackupInfo {
    const cwd = options.cwd || process.cwd();
    const aligntrueDir = join(cwd, '.aligntrue');
    
    if (!existsSync(aligntrueDir)) {
      throw new Error(`AlignTrue directory not found: ${aligntrueDir}`);
    }

    // Create backups directory if it doesn't exist
    const backupsDir = join(aligntrueDir, '.backups');
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true });
    }

    // Generate timestamp for this backup (with milliseconds for uniqueness)
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-').replace(/Z$/, '');
    const backupDir = join(backupsDir, timestamp);

    // Create backup directory
    mkdirSync(backupDir, { recursive: true });

    // Collect files to backup (everything except .backups/)
    const files: string[] = [];
    const collectFiles = (dir: string, base: string = '') => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = base ? join(base, entry.name) : entry.name;
        
        // Skip .backups directory
        if (relativePath === '.backups') continue;
        
        if (entry.isDirectory()) {
          collectFiles(fullPath, relativePath);
        } else {
          files.push(relativePath);
        }
      }
    };
    collectFiles(aligntrueDir);

    // Copy files to backup directory
    for (const file of files) {
      const srcPath = join(aligntrueDir, file);
      const destPath = join(backupDir, file);
      const destDir = dirname(destPath);
      
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      
      cpSync(srcPath, destPath);
    }

    // Create manifest
    const manifest: BackupManifest = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      files,
      created_by: options.created_by || 'manual',
      ...(options.notes && { notes: options.notes })
    };

    writeFileSync(
      join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    return {
      timestamp,
      path: backupDir,
      manifest
    };
  }

  /**
   * List all available backups
   */
  static listBackups(cwd: string = process.cwd()): BackupInfo[] {
    const backupsDir = join(cwd, '.aligntrue', '.backups');
    
    if (!existsSync(backupsDir)) {
      return [];
    }

    const entries = readdirSync(backupsDir, { withFileTypes: true });
    const backups: BackupInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const backupDir = join(backupsDir, entry.name);
      const manifestPath = join(backupDir, 'manifest.json');
      
      if (!existsSync(manifestPath)) continue;
      
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as BackupManifest;
        backups.push({
          timestamp: entry.name,
          path: backupDir,
          manifest
        });
      } catch {
        // Skip invalid manifests
        continue;
      }
    }

    // Sort by timestamp descending (newest first)
    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Restore a backup
   */
  static restoreBackup(options: RestoreOptions = {}): BackupInfo {
    const cwd = options.cwd || process.cwd();
    const backups = this.listBackups(cwd);

    if (backups.length === 0) {
      throw new Error('No backups found');
    }

    // Find backup to restore
    let backup: BackupInfo;
    if (options.timestamp) {
      const found = backups.find(b => b.timestamp === options.timestamp);
      if (!found) {
        throw new Error(`Backup not found: ${options.timestamp}`);
      }
      backup = found;
    } else {
      const mostRecent = backups[0];
      if (!mostRecent) {
        throw new Error('No backups found');
      }
      backup = mostRecent;
    }

    const aligntrueDir = join(cwd, '.aligntrue');
    
    // Validate backup directory exists
    if (!existsSync(backup.path)) {
      throw new Error(`Backup directory not found: ${backup.path}`);
    }

    // Create temporary backup of current state
    const tempBackup = this.createBackup({
      cwd,
      created_by: 'restore-temp',
      notes: 'Temporary backup before restore'
    });

    try {
      // First, remove existing files that are being restored
      for (const file of backup.manifest.files) {
        const destPath = join(aligntrueDir, file);
        if (existsSync(destPath)) {
          rmSync(destPath, { force: true });
        }
      }

      // Restore files (excluding .backups directory)
      for (const file of backup.manifest.files) {
        const srcPath = join(backup.path, file);
        const destPath = join(aligntrueDir, file);
        const destDir = dirname(destPath);
        
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        
        cpSync(srcPath, destPath);
      }

      // Clean up temp backup on success
      rmSync(tempBackup.path, { recursive: true, force: true });

      return backup;
    } catch (error) {
      // Restore from temp backup on failure
      for (const file of tempBackup.manifest.files) {
        const srcPath = join(tempBackup.path, file);
        const destPath = join(aligntrueDir, file);
        cpSync(srcPath, destPath);
      }
      
      // Clean up temp backup
      rmSync(tempBackup.path, { recursive: true, force: true });
      
      throw new Error(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clean up old backups, keeping the most recent N
   */
  static cleanupOldBackups(options: CleanupOptions = {}): number {
    const cwd = options.cwd || process.cwd();
    const keepCount = options.keepCount ?? 10;
    
    const backups = this.listBackups(cwd);
    
    if (backups.length <= keepCount) {
      return 0;
    }

    // Remove oldest backups
    const toRemove = backups.slice(keepCount);
    let removed = 0;

    for (const backup of toRemove) {
      try {
        rmSync(backup.path, { recursive: true, force: true });
        removed++;
      } catch {
        // Continue on error
      }
    }

    return removed;
  }

  /**
   * Get a specific backup by timestamp
   */
  static getBackup(cwd: string, timestamp: string): BackupInfo | undefined {
    return this.listBackups(cwd).find(b => b.timestamp === timestamp);
  }

  /**
   * Delete a specific backup
   */
  static deleteBackup(cwd: string, timestamp: string): boolean {
    const backup = this.getBackup(cwd, timestamp);
    if (!backup) {
      return false;
    }

    try {
      rmSync(backup.path, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
}

