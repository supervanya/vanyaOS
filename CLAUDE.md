@AGENTS.md

## Claude Code

Claude Code hooks (`.claude/settings.json`) do the same inside a session: every edited file is formatted and linted on the spot, and ending a turn with uncommitted changes runs `check` first. When a hook reports errors, fix them — don't work around the hook.

`/triage` takes a raw dump of notes and files them as properly labeled issues. Use it rather than filing them ad hoc — it keeps the taxonomy consistent.
