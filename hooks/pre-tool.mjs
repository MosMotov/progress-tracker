#!/usr/bin/env node
/**
 * PreToolUse hook — เขียน "กำลังทำอะไร" ก่อนลงมือ
 * สำคัญมากสำหรับ interrupt recovery: ถ้าปิดคอมกลางทาง
 * จะรู้ว่าค้างอยู่ตรงไหน
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const TRACKED_TOOLS = new Set([
  // Claude Code actual tool names
  'Write', 'Edit', 'Bash', 'PowerShell',
  // Legacy / alternative names
  'write_file', 'create_file',
  'str_replace_based_edit_tool', 'str_replace',
  'bash', 'execute_bash',
]);

// Only Bash commands that change real state are worth recording. Read-only /
// throwaway commands (cd, ls, echo, cat, grep, git status, curl probes, node -e,
// etc.) are skipped so PROGRESS.md stays signal, not noise.
const SIGNIFICANT_BASH = /(npm |pnpm |yarn |npx |prisma|tsx |\btsc\b|next build|vite build|webpack|\bmake\b|docker|pip install|cargo (build|run|test)|go (build|run|test)|git (commit|push|merge|rebase|tag|cherry-pick)|\bmkdir\b|\brm\b|\bmv\b|\bcp\b|Remove-Item|New-Item|Move-Item|Copy-Item|Compress-Archive|Expand-Archive)/i;

function isSignificant(toolName, toolInput) {
  if (/^(Bash|bash|execute_bash|PowerShell)$/.test(toolName)) {
    const cmd = String(toolInput?.command || toolInput?.cmd || '');
    return SIGNIFICANT_BASH.test(cmd);
  }
  // Write / Edit (and aliases) always change a file → always significant.
  return true;
}

function getProgressPath() {
  try {
    const root = execSync('git rev-parse --show-toplevel', { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString().trim();
    return join(root, 'PROGRESS.md');
  } catch {
    return join(process.cwd(), 'PROGRESS.md');
  }
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function describeIntent(toolName, toolInput) {
  switch (toolName) {
    case 'Write':
    case 'write_file':
    case 'create_file': {
      const path = toolInput?.file_path || toolInput?.path || 'unknown';
      return `Writing ${path}`;
    }
    case 'Edit':
    case 'str_replace_based_edit_tool':
    case 'str_replace': {
      const path = toolInput?.file_path || toolInput?.path || 'unknown';
      return `Editing ${path}`;
    }
    case 'Bash':
    case 'bash':
    case 'execute_bash':
    case 'PowerShell': {
      const cmd = (toolInput?.command || toolInput?.cmd || '').slice(0, 80);
      return `Running: ${cmd}${cmd.length >= 80 ? '...' : ''}`;
    }
    default:
      return `Running ${toolName}`;
  }
}

function updateCurrentlyDoing(content, doing) {
  const lines = content.split('\n');
  let inDoing = false;
  let replaced = false;

  const updated = lines.map(line => {
    if (line.includes('## 🔄 Currently Doing')) {
      inDoing = true;
      return line;
    }
    if (inDoing && !replaced && line.trim() && !line.startsWith('#')) {
      replaced = true;
      inDoing = false;
      return doing;
    }
    if (inDoing && line.startsWith('## ')) {
      inDoing = false;
    }
    return line;
  });

  if (!replaced) {
    const idx = updated.findIndex(l => l.includes('## 🔄 Currently Doing'));
    if (idx !== -1) updated.splice(idx + 1, 0, doing);
  }

  return updated.map(l =>
    l.startsWith('**Last updated**:') ? `**Last updated**: ${timestamp()}` : l
  ).join('\n');
}

async function main() {
  let input;
  try {
    const raw = readFileSync(0, 'utf8').replace(/^﻿/, ''); // strip BOM (Windows PowerShell pipe)
    if (!raw.trim()) process.exit(0);
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = input?.tool_name || input?.tool || '';
  if (!TRACKED_TOOLS.has(toolName)) process.exit(0);

  const toolInput = input?.tool_input || input?.input || {};
  if (!isSignificant(toolName, toolInput)) process.exit(0);

  const progressPath = getProgressPath();
  const intent = describeIntent(toolName, toolInput);

  if (!existsSync(progressPath)) {
    const sessionId = new Date().toISOString().slice(0, 16);
    writeFileSync(progressPath, `# Progress

**Last updated**: ${timestamp()}
**Session**: ${sessionId}

## 🔄 Currently Doing
${intent}

## ✅ Completed
(none yet)

## ⏭️ Next Steps
(not set)

## ⚠️ Context & Decisions
(none)
`, 'utf8');
    return;
  }

  try {
    const content = readFileSync(progressPath, 'utf8');
    writeFileSync(progressPath, updateCurrentlyDoing(content, intent), 'utf8');
  } catch {
    // ถ้าอ่านไม่ได้ ข้ามไป
  }
}

main().catch(() => process.exit(0));
