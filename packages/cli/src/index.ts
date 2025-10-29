#!/usr/bin/env node

/**
 * AlignTrue CLI - Main entry point
 */

import { init, importCommand, migrate, md, sync, team, telemetry, scopes, check, config, adapters, privacy, backup } from './commands/index.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log('AlignTrue CLI - AI-native rules and alignment platform\n');
    console.log('Usage: aligntrue <command> [options]\n');
    
    console.log('Basic Commands:');
    console.log('  init           Initialize AlignTrue in current directory');
    console.log('  sync           Sync rules to agents');
    console.log('  import         Import rules from agent configs');
    console.log('  check          Validate rules and configuration\n');
    
    console.log('Development Commands:');
    console.log('  adapters       Manage exporters (list, enable, disable)');
    console.log('  md             Markdown validation and formatting\n');
    
    console.log('Team Commands:');
    console.log('  team           Team mode management');
    console.log('  scopes         List configured scopes\n');
    
    console.log('Settings:');
    console.log('  config         View or edit configuration');
    console.log('  telemetry      Telemetry settings');
    console.log('  privacy        Privacy and consent management\n');
    
    console.log('Coming Soon:');
    console.log('  migrate        Schema migration (preview mode)');
    
    console.log('\nRun aligntrue <command> --help for command-specific options');
    process.exit(0);
  }
  
  const command = args[0];
  const commandArgs = args.slice(1);
  
  // Handle implemented commands
  if (command === 'init') {
    await init(commandArgs);
    return;
  }
  
  if (command === 'import') {
    await importCommand(commandArgs);
    return;
  }
  
  if (command === 'migrate') {
    await migrate();
    return;
  }
  
  if (command === 'md') {
    await md(commandArgs);
    return;
  }
  
  if (command === 'sync') {
    await sync(commandArgs);
    return;
  }
  
  if (command === 'team') {
    await team(commandArgs);
    return;
  }
  
  if (command === 'telemetry') {
    await telemetry(commandArgs);
    return;
  }
  
  if (command === 'scopes') {
    await scopes(commandArgs);
    return;
  }
  
  if (command === 'check') {
    await check(commandArgs);
    return;
  }
  
  if (command === 'config') {
    await config(commandArgs);
    return;
  }
  
  if (command === 'adapters') {
    await adapters(commandArgs);
    return;
  }
  
  if (command === 'privacy') {
    await privacy(commandArgs);
    return;
  }
  
  if (command === 'backup') {
    await backup(commandArgs);
    return;
  }
  
  console.error(`Command not implemented: ${command}`);
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

