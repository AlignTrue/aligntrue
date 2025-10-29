/**
 * Backup command for AlignTrue CLI
 * 
 * Manages backups of .aligntrue/ directory with create/list/restore/cleanup subcommands
 */

import * as clack from '@clack/prompts';
import { BackupManager, type BackupInfo } from '@aligntrue/core';
import { parseCommonArgs, showStandardHelp } from '../utils/command-utilities.js';

interface BackupArgs {
  // Common
  help?: boolean;
  config?: string;
  
  // Create subcommand
  notes?: string;
  
  // Restore subcommand
  to?: string;
  
  // Cleanup subcommand
  keep?: string;
}

const HELP_TEXT = `
Usage: aligntrue backup <subcommand> [options]

Manage backups of your .aligntrue/ directory

Subcommands:
  create              Create a manual backup
  list                List all available backups
  restore             Restore from a backup (most recent by default)
  cleanup             Remove old backups (keeps 10 most recent by default)

Options:
  --notes <text>      Add notes to backup (create subcommand)
  --to <timestamp>    Restore specific backup by timestamp (restore subcommand)
  --keep <count>      Number of backups to keep (cleanup subcommand)
  --config <path>     Path to config file
  --help              Show this help message

Examples:
  # Create a manual backup with notes
  aligntrue backup create --notes "Before major refactor"

  # List all backups
  aligntrue backup list

  # Restore most recent backup
  aligntrue backup restore

  # Restore specific backup
  aligntrue backup restore --to 2025-10-29T12-34-56-789

  # Clean up old backups, keep only 5
  aligntrue backup cleanup --keep 5
`;

export async function backupCommand(argv: string[]): Promise<void> {
  const args = parseCommonArgs(argv);

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const subcommand = args.positional[0] as string | undefined ?? argv[0];

  if (!subcommand) {
    clack.log.error('Missing subcommand');
    console.log(HELP_TEXT);
    process.exit(2);
  }

  const cwd = process.cwd();

  try {
    switch (subcommand) {
      case 'create':
        await handleCreate(cwd, args, argv);
        break;

      case 'list':
        await handleList(cwd);
        break;

      case 'restore':
        await handleRestore(cwd, args, argv);
        break;

      case 'cleanup':
        await handleCleanup(cwd, args, argv);
        break;

      default:
        clack.log.error(`Unknown subcommand: ${subcommand}`);
        console.log(HELP_TEXT);
        process.exit(2);
    }
  } catch (error) {
    clack.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function handleCreate(cwd: string, args: BackupArgs, argv: string[]): Promise<void> {
  const spinner = clack.spinner();
  spinner.start('Creating backup...');

  // Parse notes from argv manually if needed
  const notesIndex = argv.indexOf('--notes');
  const notes = notesIndex >= 0 && argv[notesIndex + 1] ? argv[notesIndex + 1] : args.notes;

  try {
    const backupOptions: { cwd: string; created_by: string; notes?: string } = {
      cwd,
      created_by: 'manual',
    };
    if (notes) {
      backupOptions.notes = notes;
    }
    const backup = BackupManager.createBackup(backupOptions);

    spinner.stop('Backup created');
    
    clack.log.success(`Backup: ${backup.timestamp}`);
    if (backup.manifest.notes) {
      clack.log.info(`Notes: ${backup.manifest.notes}`);
    }
    clack.log.info(`Files: ${backup.manifest.files.length} backed up`);
    clack.log.step(`Location: ${backup.path}`);
  } catch (error) {
    spinner.stop('Backup failed');
    throw error;
  }
}

async function handleList(cwd: string): Promise<void> {
  const backups = BackupManager.listBackups(cwd);

  if (backups.length === 0) {
    clack.log.warn('No backups found');
    return;
  }

  clack.log.success(`Found ${backups.length} backup${backups.length === 1 ? '' : 's'}:\n`);

  for (const backup of backups) {
    const date = new Date(backup.manifest.timestamp);
    const formattedDate = date.toLocaleString();
    
    console.log(`  ${backup.timestamp}`);
    console.log(`    Created: ${formattedDate}`);
    console.log(`    By: ${backup.manifest.created_by}`);
    console.log(`    Files: ${backup.manifest.files.length}`);
    if (backup.manifest.notes) {
      console.log(`    Notes: ${backup.manifest.notes}`);
    }
    console.log();
  }
}

async function handleRestore(cwd: string, args: BackupArgs, argv: string[]): Promise<void> {
  const backups = BackupManager.listBackups(cwd);

  if (backups.length === 0) {
    throw new Error('No backups found');
  }

  // Parse --to from argv manually if needed
  const toIndex = argv.indexOf('--to');
  const toTimestamp = toIndex >= 0 && argv[toIndex + 1] ? argv[toIndex + 1] : args.to;

  let targetBackup: BackupInfo | undefined;

  if (toTimestamp) {
    targetBackup = backups.find(b => b.timestamp === toTimestamp);
    if (!targetBackup) {
      throw new Error(`Backup not found: ${toTimestamp}`);
    }
  } else {
    targetBackup = backups[0]; // Most recent
  }

  if (!targetBackup) {
    clack.log.error('No backups available to restore');
    process.exit(1);
  }

  // Show what will be restored
  const date = new Date(targetBackup.manifest.timestamp);
  const formattedDate = date.toLocaleString();

  clack.log.warn('This will overwrite your current .aligntrue/ directory');
  clack.log.info(`Restoring backup from ${formattedDate}`);
  clack.log.info(`Files: ${targetBackup.manifest.files.length}`);

  const confirmed = await clack.confirm({
    message: 'Continue with restore?',
    initialValue: false
  });

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.log.step('Restore cancelled');
    return;
  }

  const spinner = clack.spinner();
  spinner.start('Restoring backup...');

  try {
    const restoreOptions: { cwd: string; timestamp?: string } = { cwd };
    if (toTimestamp) {
      restoreOptions.timestamp = toTimestamp;
    }
    const restored = BackupManager.restoreBackup(restoreOptions);

    spinner.stop('Restore complete');
    
    clack.log.success(`Restored backup: ${restored.timestamp}`);
    clack.log.info(`Files restored: ${restored.manifest.files.length}`);
  } catch (error) {
    spinner.stop('Restore failed');
    throw error;
  }
}

async function handleCleanup(cwd: string, args: BackupArgs, argv: string[]): Promise<void> {
  const keepIndex = argv.indexOf('--keep');
  const keepValue = keepIndex >= 0 && argv[keepIndex + 1] ? argv[keepIndex + 1] : args.keep;
  const keepCount = keepValue ? parseInt(keepValue, 10) : 10;

  if (isNaN(keepCount) || keepCount < 1) {
    throw new Error(`Invalid --keep value: ${args.keep}. Must be a positive number.`);
  }

  const backups = BackupManager.listBackups(cwd);

  if (backups.length <= keepCount) {
    clack.log.info(`No cleanup needed (${backups.length} backups, keeping ${keepCount})`);
    return;
  }

  const toRemove = backups.length - keepCount;

  clack.log.warn(`Will remove ${toRemove} old backup${toRemove === 1 ? '' : 's'}`);
  clack.log.info(`Keeping ${keepCount} most recent backups`);

  const confirmed = await clack.confirm({
    message: 'Continue with cleanup?',
    initialValue: true
  });

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.log.step('Cleanup cancelled');
    return;
  }

  const spinner = clack.spinner();
  spinner.start('Cleaning up old backups...');

  try {
    const removed = BackupManager.cleanupOldBackups({ cwd, keepCount });

    spinner.stop('Cleanup complete');
    
    clack.log.success(`Removed ${removed} backup${removed === 1 ? '' : 's'}`);
    clack.log.info(`${keepCount} backups remaining`);
  } catch (error) {
    spinner.stop('Cleanup failed');
    throw error;
  }
}

