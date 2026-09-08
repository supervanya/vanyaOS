---
description: Turn a raw dump of notes/feedback into properly labeled GitHub issues
allowed-tools: Bash(gh:*), Read, Grep, Glob
---

Triage the following raw feedback into GitHub issues.

<dump>
$ARGUMENTS
</dump>

If the dump is empty, ask the user to paste their notes and stop.

## Process

**1. Split.** Break the dump into individual work items. One note line often contains two items ("streaks would be nice, also the chip is tiny") — split those. Merge genuine duplicates.

**2. Check for existing issues.** Run `gh issue list --state all --limit 100` and skip anything already filed. Mention what you skipped.

**3. Classify each item** per the conventions in @CLAUDE.md:
- one `type/` label — `type/bug`, `type/polish`, `type/feature`, or `type/chore`
- one `size/` label — `size/xs` (<30min), `size/s` (~1h), `size/m` (a session), `size/l` (multiple sessions)
- a milestone — `M4`, `M5`, `M6`, or `Backlog`, matching @docs/ROADMAP.md

Size is your estimate of effort. Look at the actual code before guessing — a "just move the button" is sometimes `size/m`. If an item is `size/l`, propose splitting it.

**4. Flag dependencies.** If item B can't start until item A ships, note it. Also check the existing open issues for blockers.

**5. Show the user the table before filing anything:**

| # | Title | type | size | milestone | notes |
|---|---|---|---|---|---|

Call out explicitly:
- items you couldn't classify confidently (ask rather than guess)
- items that are already covered by an existing issue
- items that are really *strategy* changes — a shift in what a milestone means. Those belong in `docs/ROADMAP.md`, not an issue. Say so and don't file them.

**6. Wait for confirmation**, then file with `gh issue create`, applying labels and milestone in the same call. Add `Blocked by #N` lines to bodies where dependencies exist, and the `blocked` label where it currently applies.

**7. Report** the created issue numbers and URLs.

## Issue body format

Keep bodies short. A polish item needs two lines, not a template.

```
<one sentence: what's wrong or what's wanted>

**Now:** <current behavior — omit for new features>
**Want:** <desired behavior>

<file:line references if you found them>
```

Do not pad with headings the item doesn't need. Never invent acceptance criteria the user didn't imply — if the bar is unclear, that's a question for the table in step 5.
