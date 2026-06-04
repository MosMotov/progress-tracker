#!/usr/bin/env node
/**
 * Installs progress-tracker hooks into ~/.claude/settings.json
 * and copies hook scripts to ~/.claude/skills/progress-tracker/
 *
 * Usage: node install.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const home = homedir();
const skillsDir = join(home, '.claude', 'skills', 'progress-tracker');
const hooksDir = join(skillsDir, 'hooks');
const settingsPath = join(home, '.claude', 'settings.json');

// 1. Copy hook files
mkdirSync(hooksDir, { recursive: true });
for (const f of ['pre-tool.mjs', 'post-tool.mjs', 'session-start.mjs']) {
  copyFileSync(join(__dirname, 'hooks', f), join(hooksDir, f));
}
copyFileSync(join(__dirname, 'SKILL.md'), join(skillsDir, 'SKILL.md'));

// 2. Update ~/.claude/settings.json
let settings = {};
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    console.error(`Warning: could not parse ${settingsPath} — will create a new one`);
  }
}
if (!settings.hooks) settings.hooks = {};

const hookDefs = [
  { event: 'SessionStart', file: 'session-start' },
  { event: 'PreToolUse',   file: 'pre-tool' },
  { event: 'PostToolUse',  file: 'post-tool' },
];

for (const { event, file } of hookDefs) {
  if (!settings.hooks[event]) settings.hooks[event] = [];
  const alreadyInstalled = settings.hooks[event].some(entry =>
    entry.hooks?.some(h => typeof h.command === 'string' && h.command.includes('progress-tracker'))
  );
  if (!alreadyInstalled) {
    settings.hooks[event].push({
      hooks: [{ type: 'command', command: `node "${join(hooksDir, file + '.mjs')}"` }],
    });
  }
}

writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

console.log('✅ progress-tracker installed successfully');
console.log(`   Hooks: ${hooksDir}`);
console.log(`   Settings: ${settingsPath}`);
console.log('');
console.log('Restart Claude Code to activate.');
