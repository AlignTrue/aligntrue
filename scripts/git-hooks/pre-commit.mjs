#!/usr/bin/env node

import { execSync } from 'child_process';
import * as clack from '@clack/prompts';

async function main() {
  clack.intro('🔍 Running pre-commit checks...');
  const s = clack.spinner();
  s.start('Formatting staged files with Prettier...');

  try {
    execSync('pnpm lint-staged', { stdio: 'pipe' });
    s.stop('✅ Files formatted successfully.');
    clack.outro('All pre-commit checks passed');
    process.exit(0);
  } catch (error) {
    s.stop('❌ Pre-commit checks failed.', 1);
    
    clack.log.error('Could not format staged files.');

    console.error('\n📝 Some files were not correctly formatted by Prettier.');
    console.error('   This usually happens when there are syntax errors in the staged files.');
    console.error('\n   Please review the errors above, fix them, and try committing again.');
    console.error(
      "\n   You can also run 'pnpm format' to format the entire project and see if there are other issues."
    );

    clack.outro('💡 Fix the formatting issues and re-stage the files.');
    process.exit(1);
  }
}

main();
