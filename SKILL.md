---
name: progress-tracker
description: >
  Automatically tracks work progress during every Claude Code session by writing to PROGRESS.md
  in the project directory after each significant action. Designed to survive interruptions —
  if the user closes their laptop mid-task, they can resume exactly where they left off.
  Use this skill whenever working on any multi-step coding task, debugging session, feature
  implementation, or any work that might be interrupted. Can run with or without hooks —
  the hookless mode requires no Node.js and works on any platform.
---

# Progress Tracker

Logs progress to `PROGRESS.md` automatically so work can resume after any interruption — no manual commands needed.

## How It Works

1. **PostToolUse** — after each significant tool call (write file, bash, edit), updates `PROGRESS.md`
2. **SessionStart** — on a new session, reads `PROGRESS.md` and briefs the user on where they left off
3. **PreToolUse** — writes "currently doing" before each action so interruptions leave a recoverable state

## PROGRESS.md Structure

```markdown
# Progress

**Last updated**: <timestamp>
**Session**: <session-id>

## 🔄 Currently Doing
<what Claude is about to do — written before starting>

## ✅ Completed
- <timestamp> — <completed action>
- ...

## ⏭️ Next Steps
- <ordered list of remaining tasks>

## ⚠️ Context & Decisions
- <key decisions made and why>
```

## Installation

### Option A: Hookless — no Node.js required (recommended)

No external scripts needed. Claude handles all `PROGRESS.md` updates natively using its own Write/Edit tools.

Add this instruction to your `~/.claude/CLAUDE.md`:

```markdown
## Progress Tracking

At the start of every session, check if `PROGRESS.md` exists in the project root.
If it does, read it and tell me:
  - What was in progress (Currently Doing)
  - How many items were completed
  - The first Next Step

Before each significant action (Write, Edit, Bash, PowerShell), update the
"Currently Doing" section of PROGRESS.md. After completing the action, append
it to the Completed list with a timestamp (DD/MM/YYYY HH:MM:SS format).

Track only Write, Edit, Bash, and PowerShell calls. Skip Read, Grep, Glob,
WebSearch, WebFetch.
```

**Trade-off**: Claude must invoke the skill once per session (`/progress-tracker`),
and each progress update costs one extra Write tool call.

### Option B: With Hooks — fully automatic (requires Node.js)

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "node \"$HOME/.claude/skills/progress-tracker/hooks/session-start.mjs\""
        }]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [{
          "type": "command",
          "command": "node \"$HOME/.claude/skills/progress-tracker/hooks/pre-tool.mjs\""
        }]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [{
          "type": "command",
          "command": "node \"$HOME/.claude/skills/progress-tracker/hooks/post-tool.mjs\""
        }]
      }
    ]
  }
}
```

**Trade-off**: Requires Node.js, but tracking is fully automatic with zero overhead on Claude's responses.

## Claude's Behavior

### On Session Start
If `PROGRESS.md` exists in the project, read it and tell the user:
```
📋 Found progress from previous session:
Was doing: <currently doing>
Completed: <count> items
Next step: <first next step>

Continue from here?
```

### On Interruption (no session end)
Data survives because PROGRESS.md is written before each action, not only at session end.

### Tools That Trigger a Progress Update
- `Write`, `Edit` → log "wrote/edited file X"
- `Bash`, `PowerShell` → log short command summary
- `Read`, `Grep`, `Glob` → no log (read-only, not an action)
- `WebSearch`, `WebFetch` → no log

## Notes
- Add `PROGRESS.md` to `.gitignore` if you don't want to commit it
- Without a git repo, the file is created in the current working directory
- Session ID uses a timestamp to distinguish sessions
- The `hooks/` folder is only needed for Option B
