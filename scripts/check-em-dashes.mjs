#!/usr/bin/env node
// =============================================================================
// Build-time guard. Fails the build if any em dash, en dash, or related
// dash-like character appears in source code outside the stripper itself.
//
// Brand voice rule: no em dashes in any user-visible report content. The
// stripper is the runtime defense. This script is the build-time defense.
//
// Run via: node scripts/check-em-dashes.mjs
// Wired into the package.json build pipeline so CI fails if a dash sneaks in.
// =============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src';
const DASH_PATTERN = /[—–―⸺⸻]/;

// The stripper file legitimately contains dash characters inside regex
// character classes. It is the one allowed exception.
const ALLOWED_FILES = new Set([
  'src/lib/text/strip-em-dash.ts',
]);

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walk(path));
    } else if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      files.push(path);
    }
  }
  return files;
}

const files = walk(ROOT);
const violations = [];

for (const file of files) {
  if (ALLOWED_FILES.has(file)) continue;
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (DASH_PATTERN.test(lines[i])) {
      violations.push({ file: relative(process.cwd(), file), line: i + 1, text: lines[i].trim() });
    }
  }
}

if (violations.length > 0) {
  console.error('\n[em-dash-check] FAILED. Em dashes (or related dash characters) found in source code.');
  console.error('[em-dash-check] Brand voice rule: no em dashes in any report-generating code.\n');
  for (const v of violations.slice(0, 25)) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text.slice(0, 140)}${v.text.length > 140 ? '...' : ''}`);
  }
  if (violations.length > 25) {
    console.error(`\n  (${violations.length - 25} more violations omitted)`);
  }
  console.error('\nFix: replace em dashes with periods, commas, parentheses, or colons.');
  console.error('Or run the runtime stripper utility for AI-generated text.');
  process.exit(1);
}

console.log(`[em-dash-check] OK. Inspected ${files.length} files. No dash violations.`);
