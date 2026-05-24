# Progress Tracker for Claude Code

Auto-tracks your work progress during every Claude Code session by writing `PROGRESS.md` after each significant action. Built for **interrupt recovery** — close your laptop mid-task and pick up exactly where you left off.

---

## How It Works

Three hooks work silently in the background:

| Hook | Trigger | What it does |
|------|---------|--------------|
| `PreToolUse` | Before Write / Edit / Bash | Records "currently doing" in PROGRESS.md |
| `PostToolUse` | After Write / Edit / Bash | Logs the completed action with timestamp |
| `SessionStart` | Every new session | Briefs Claude on previous progress |

**Example `PROGRESS.md`:**

```markdown
# Progress

**Last updated**: 23/05/2026 14:30:00
**Session**: 2026-05-23T14

## 🔄 Currently Doing
Writing src/auth/login.ts

## ✅ Completed
- 23/05/2026 14:25:00 — Wrote src/utils/token.ts
- 23/05/2026 14:20:00 — Ran: npm install jsonwebtoken

## ⏭️ Next Steps
(not set)

## ⚠️ Context & Decisions
(none yet)
```

---

## Requirements

- [Claude Code](https://claude.ai/code)
- Node.js 18+
- Git (optional — used to find project root for PROGRESS.md placement)

---

## Installation

### Option A — Claude Code Web (no terminal needed)

1. Download `progress-tracker.zip` from [Releases](../../releases)
2. In Claude Code → **Settings** → **Skills** → **Upload ZIP**
3. Done — hooks are configured automatically

### Option B — Manual extract

```bash
# macOS / Linux
unzip progress-tracker.zip -d ~/.claude/skills/

# Windows (PowerShell)
Expand-Archive progress-tracker.zip -DestinationPath "$env:USERPROFILE\.claude\skills\"
```

Then add hooks to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node \"/Users/YOU/.claude/skills/progress-tracker/hooks/session-start.mjs\"" }] }
    ],
    "PreToolUse": [
      { "hooks": [{ "type": "command", "command": "node \"/Users/YOU/.claude/skills/progress-tracker/hooks/pre-tool.mjs\"" }] }
    ],
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "node \"/Users/YOU/.claude/skills/progress-tracker/hooks/post-tool.mjs\"" }] }
    ]
  }
}
```

Replace `/Users/YOU` with your home directory path.

---

## Tips

- Add `PROGRESS.md` to your `.gitignore` — it's a local scratchpad, not source code
- `PROGRESS.md` is placed in the **git root** of your project (or `cwd` if no git repo)
- The Completed log keeps the last 50 actions to stay lightweight
- Works on macOS, Linux, and Windows

---

## File Structure

```
progress-tracker/
├── SKILL.md                  ← Claude Code skill definition
└── hooks/
    ├── pre-tool.mjs          ← PreToolUse hook
    ├── post-tool.mjs         ← PostToolUse hook
    └── session-start.mjs     ← SessionStart hook
```

---

## License

MIT — see [LICENSE](LICENSE)
