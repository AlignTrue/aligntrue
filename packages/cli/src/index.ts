#!/usr/bin/env node

/**
 * AlignTrue CLI - Main entry point
 */

import { migrate } from './commands/index.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log('AlignTrue CLI - AI-native rules and alignment platform\n');
    console.log('Usage: aligntrue <command> [options]\n');
    console.log('Commands:');
    console.log('  init           Initialize AlignTrue in current directory');
    console.log('  sync           Sync rules to agents');
    console.log('  check          Validate rules and configuration');
    console.log('  import         Import rules from agent configs');
    console.log('  migrate        Migration status (preview mode)');
    console.log('\nRun aligntrue <command> --help for command-specific help');
    process.exit(0);
  }
  
  const command = args[0];
  
  // Handle implemented commands
  if (command === 'migrate') {
    await migrate();
    return;
  }
  
  console.error(`Command not implemented: ${command}`);
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

