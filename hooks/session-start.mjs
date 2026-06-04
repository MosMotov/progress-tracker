#!/usr/bin/env node
/**
 * SessionStart hook — reads PROGRESS.md and briefs Claude on previous session
 * Output is injected into Claude's context at session start
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

function getProgressPath() {
  try {
    const root = execSync('git rev-parse --show-toplevel', { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString().trim();
    return join(root, 'PROGRESS.md');
  } catch {
    return join(process.cwd(), 'PROGRESS.md');
  }
}

function parseProgress(content) {
  const data = {
    lastUpdated: '',
    sessionId: '',
    currentlyDoing: '',
    completed: [],
    nextSteps: [],
    context: [],
  };

  const lines = content.split('\n');
  let section = null;

  for (const line of lines) {
    if (line.startsWith('**Last updated**:')) {
      data.lastUpdated = line.replace('**Last updated**:', '').trim();
    } else if (line.startsWith('**Session**:')) {
      data.sessionId = line.replace('**Session**:', '').trim();
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
    } else if (section === 'doing' && line.trim() && !line.startsWith('#') && !line.startsWith('(')) {
      data.currentlyDoing = line.trim();
    } else if (section === 'completed' && line.startsWith('- ')) {
      data.completed.push(line.slice(2).trim());
    } else if (section === 'next' && line.startsWith('- ') && !line.includes('(')) {
      data.nextSteps.push(line.slice(2).trim());
    } else if (section === 'context' && line.startsWith('- ') && !line.includes('(')) {
      data.context.push(line.slice(2).trim());
    }
  }

  return data;
}

function main() {
  const progressPath = getProgressPath();

  if (!existsSync(progressPath)) {
    process.exit(0);
  }

  let data;
  try {
    data = parseProgress(readFileSync(progressPath, 'utf8'));
  } catch {
    process.exit(0);
  }

  if (!data.currentlyDoing && data.completed.length === 0) {
    process.exit(0);
  }

  const recentCompleted = data.completed.slice(-5);

  let summary = `\n[PROGRESS TRACKER] Found progress from previous session (${data.lastUpdated})\n`;

  if (data.currentlyDoing) {
    summary += `\n⚠️  Was in the middle of: ${data.currentlyDoing}\n`;
    summary += `    (May have been interrupted — verify whether this action completed)\n`;
  }

  if (recentCompleted.length > 0) {
    summary += `\n✅ Recently completed (${recentCompleted.length} items):\n`;
    recentCompleted.forEach(c => { summary += `   - ${c}\n`; });
    if (data.completed.length > 5) {
      summary += `   ... and ${data.completed.length - 5} more\n`;
    }
  }

  if (data.nextSteps.length > 0) {
    summary += `\n⏭️  Next steps:\n`;
    data.nextSteps.slice(0, 3).forEach(s => { summary += `   - ${s}\n`; });
  }

  if (data.context.length > 0) {
    summary += `\n⚠️  Important context:\n`;
    data.context.forEach(c => { summary += `   - ${c}\n`; });
  }

  summary += `\n[Inform the user about this progress and ask if they want to continue from here]\n`;

  process.stdout.write(summary);
}

main();
