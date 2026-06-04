#!/usr/bin/env node
/**
 * PostToolUse hook — บันทึกหลังจาก tool call เสร็จ
 * Claude Code ส่ง JSON มาทาง stdin
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

// Keep this list in sync with pre-tool.mjs — only state-changing Bash commands
// are logged; read-only/throwaway commands are ignored to avoid noise.
const SIGNIFICANT_BASH = /(npm |pnpm |yarn |npx |prisma|tsx |\btsc\b|next build|vite build|webpack|\bmake\b|docker|pip install|cargo (build|run|test)|go (build|run|test)|git (commit|push|merge|rebase|tag|cherry-pick)|\bmkdir\b|\brm\b|\bmv\b|\bcp\b|Remove-Item|New-Item|Move-Item|Copy-Item|Compress-Archive|Expand-Archive)/i;

function isSignificant(toolName, toolInput) {
  if (/^(Bash|bash|execute_bash|PowerShell)$/.test(toolName)) {
    const cmd = String(toolInput?.command || toolInput?.cmd || '');
    return SIGNIFICANT_BASH.test(cmd);
  }
  return true;
}

const MAX_COMPLETED = 50;

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

function parseProgress(content) {
  const sections = {
    currentlyDoing: '',
    completed: [],
    nextSteps: [],
    context: [],
    sessionId: '',
  };

  const lines = content.split('\n');
  let section = null;

  for (const line of lines) {
    if (line.startsWith('**Session**:')) {
      sections.sessionId = line.replace('**Session**:', '').trim();
    } else if (line.includes('## 🔄 Currently Doing')) {
      section = 'doing';
    } else if (line.includes('## ✅ Completed')) {
      section = 'completed';
    } else if (line.includes('## ⏭️ Next Steps')) {
      section = 'next';
    } else if (line.includes('## ⚠️ Context')) {
      section = 'context';
    } else if (line.startsWith('## ')) {
      section = null;
    } else if (section === 'doing' && line.trim() && !line.startsWith('#')) {
      sections.currentlyDoing = line.trim();
    } else if (section === 'completed' && line.startsWith('- ')) {
      sections.completed.push(line.slice(2).trim());
    } else if (section === 'next' && line.startsWith('- ')) {
      sections.nextSteps.push(line.slice(2).trim());
    } else if (section === 'context' && line.startsWith('- ')) {
      sections.context.push(line.slice(2).trim());
    }
  }

  return sections;
}

function buildProgress(data) {
  const completed = data.completed.slice(-MAX_COMPLETED);
  return `# Progress

**Last updated**: ${timestamp()}
**Session**: ${data.sessionId || new Date().toISOString().slice(0, 16)}

## 🔄 Currently Doing
${data.currentlyDoing || '(idle)'}

## ✅ Completed
${completed.length > 0 ? completed.map(c => `- ${c}`).join('\n') : '(none yet)'}

## ⏭️ Next Steps
${data.nextSteps.length > 0 ? data.nextSteps.map(s => `- ${s}`).join('\n') : '(not set)'}

## ⚠️ Context & Decisions
${data.context.length > 0 ? data.context.map(c => `- ${c}`).join('\n') : '(none)'}
`;
}

function describeToolCall(toolName, toolInput) {
  switch (toolName) {
    case 'Write':
    case 'write_file':
    case 'create_file': {
      const path = toolInput?.file_path || toolInput?.path || 'unknown';
      return `Wrote ${path}`;
    }
    case 'Edit':
    case 'str_replace_based_edit_tool':
    case 'str_replace': {
      const path = toolInput?.file_path || toolInput?.path || 'unknown';
      return `Edited ${path}`;
    }
    case 'Bash':
    case 'bash':
    case 'execute_bash':
    case 'PowerShell': {
      const cmd = (toolInput?.command || toolInput?.cmd || '').slice(0, 80);
      return `Ran: ${cmd}${cmd.length >= 80 ? '...' : ''}`;
    }
    default:
      return `${toolName}`;
  }
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

  const toolInputForCheck = input?.tool_input || input?.input || {};
  if (!isSignificant(toolName, toolInputForCheck)) process.exit(0);

  if (input?.response?.is_error || input?.is_error) process.exit(0);

  const progressPath = getProgressPath();
  let data = {
    currentlyDoing: '',
    completed: [],
    nextSteps: [],
    context: [],
    sessionId: new Date().toISOString().slice(0, 16),
  };

  if (existsSync(progressPath)) {
    try {
      data = { ...data, ...parseProgress(readFileSync(progressPath, 'utf8')) };
    } catch { /* เริ่มใหม่ถ้าอ่านไม่ได้ */ }
  }

  const description = describeToolCall(toolName, input?.tool_input || input?.input || {});
  data.completed.push(`${timestamp()} — ${description}`);

  // The action just finished, so nothing is "currently doing" anymore. Clearing
  // it means "Currently Doing" only shows a value when a pre-tool intent was set
  // but post-tool never ran — i.e. a genuine interruption.
  data.currentlyDoing = '';

  writeFileSync(progressPath, buildProgress(data), 'utf8');
}

main().catch(() => process.exit(0));
