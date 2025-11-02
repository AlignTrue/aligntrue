#!/usr/bin/env node

import { readFileSync } from "fs";
import * as s from "@clack/prompts";

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  process.exit(0);
}

const commitMsg = readFileSync(commitMsgFile, "utf8").trim();

// Allow comments to be stripped
const commitMsgClean = commitMsg.replace(/^#.*$/gm, "").trim();

if (commitMsgClean === "") {
  // Allow empty commit messages for git rebase -i > squash
  process.exit(0);
}

const conventionalPattern =
  /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(\(.+\))?!?: .{1,}/;

const isConventional = conventionalPattern.test(commitMsgClean);
const subject = commitMsgClean.split("\n")[0].split(": ")[1] || "";
const isSentenceCase =
  subject.length > 0 && subject[0] === subject[0].toUpperCase();

if (isConventional && isSentenceCase) {
  process.exit(0);
}

s.intro("Commit message validation failed");

if (!isConventional) {
  s.log.error("❌ Invalid commit message format");
  console.error(
    "\\n📝 Commit messages must follow the Conventional Commits format:",
  );
  console.error("   <type>(optional scope): <description>");
  console.error(
    "\\n   Valid types: 'feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'build'",
  );
  console.error("\\n   Examples:");
  console.error("   ✅ feat: Add drift detection command");
  console.error("   ✅ fix(parser): Resolve lockfile sync issue");
  console.error("   ✅ docs: Update DEVELOPMENT.md with testing guide");
}

if (!isSentenceCase) {
  s.log.error("❌ Subject must be in sentence case");
  console.error(
    "\\n📝 The description after the colon must start with a capital letter.",
  );
  if (subject) {
    const correctedSubject = subject.charAt(0).toUpperCase() + subject.slice(1);
    const correctedMsg = commitMsgClean.replace(subject, correctedSubject);
    console.error(`\\n   Suggested change:`);
    console.error(`   ${correctedMsg}`);
  }
}

s.outro("💡 Fix your commit message and try again.");
process.exit(1);
