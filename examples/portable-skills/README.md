# Portable Skills (extracted from gstack)

Minimal, self-contained versions of four gstack workflow skills:

- `investigate/` — systematic debugging with root-cause investigation (4-phase workflow)
- `review/` — pre-landing PR review with fix-first flow
- `ship/` — fully automated ship workflow (test → review → version bump → changelog → commit → PR)
- `retro/` — weekly engineering retrospective with trend tracking

These are prompt-only — no binaries, no daemons, no Node/Bun install.
Pure Markdown SKILL.md files that Claude Code reads at skill load time.

## What's different from the gstack originals

### Removed
- **Update check + auto-upgrade** (`gstack-update-check`)
- **Session tracking** (`~/.gstack/sessions/`)
- **Telemetry enrollment + logging** (`gstack-telemetry-log`)
- **Contributor mode** (field reports to `~/.gstack/contributor-logs/`)
- **"Boil the Lake" intro walkthrough** (the one-time dialog)
- **Browser ($B) integration** (that's a gstack-specific binary)
- **Freeze hooks** (pre-tool-use hook on Edit/Write)
- **Skill cross-references** to `~/.claude/skills/gstack/bin/*`
- **Rails/Ruby-specific paths** in `/ship` (e.g., `bin/test-lane`, `RAILS_ENV=test`)
- **Greptile review integration** (third-party PR bot)
- **Eval suites** and LLM-judge infrastructure
- **Adversarial step** (Codex cross-check)

### Kept (these are prompt-logic, not infrastructure)
- **Branch re-grounding** — single `git branch --show-current` call
- **Base branch detection** — inline fallback to `main`
- **AskUserQuestion format contract** — re-ground / simplify / recommend / options
- **Completeness Principle — Boil the Lake** — always recommend complete over shortcut
- **Search Before Building** — three-layer knowledge model
- **Completion Status Protocol** — DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
- **Escalation format** — 3-strike rule
- **Pre-Landing Review checklist** — SQL safety, race conditions, trust boundaries, enums
- **Fix-First Heuristic** — AUTO-FIX vs ASK classification
- **Bisectable commits** — one logical change per commit
- **Verification gate** — no completion claims without fresh test output

## Installation

### Option 1: Static copy

Copy the generated `SKILL.md` files to your Claude Code skills directory:

```bash
# Into the project
mkdir -p .claude/skills
cp -r portable-skills/investigate portable-skills/review portable-skills/ship portable-skills/retro .claude/skills/

# Or into user-global skills
cp -r portable-skills/investigate portable-skills/review portable-skills/ship portable-skills/retro ~/.claude/skills/
```

Each skill is self-contained — no shared binaries, no cross-skill dependencies
except that `/ship` reads `../review/checklist.md`, so keep the `review/`
folder next to `ship/` if you install `/ship`.

### Option 2: Template-based (recommended for long-term use)

Copy the whole `portable-skills/` folder into your repo (e.g., `.claude/skills/`
or any location you prefer). Then edit the `.tmpl` files and shared
`_templates/PREAMBLE.md` to customize, and re-run the generator:

```bash
node scripts/gen-skill-docs.mjs             # regenerate all SKILL.md files
node scripts/gen-skill-docs.mjs --dry-run   # CI freshness check
```

The generator is **zero-dependency** — works with Node 18+ or Bun. No
`package.json` required.

### Why the template system?

- **Shared preamble.** Edit `_templates/PREAMBLE.md` once, all four skills
  pick up the change on regeneration. No copy-paste drift.
- **Committed output.** Generated `SKILL.md` files are committed so Claude
  Code can read them at skill load time without a build step.
- **CI freshness check.** Add `node scripts/gen-skill-docs.mjs --dry-run` to
  your CI to catch templates that were edited without regenerating.

### Adding your own placeholders

Open `scripts/gen-skill-docs.mjs` and extend the `RESOLVERS` object:

```js
const RESOLVERS = {
  PREAMBLE: () => loadTemplateFragment('PREAMBLE'),
  BASE_BRANCH_DETECT: () => loadTemplateFragment('BASE_BRANCH_DETECT'),
  // Add your own:
  MY_PROJECT_CONTEXT: () => loadTemplateFragment('MY_PROJECT_CONTEXT'),
};
```

Then create `_templates/MY_PROJECT_CONTEXT.md` and use `{{MY_PROJECT_CONTEXT}}`
in any `.tmpl` file. For dynamic resolvers (not just file loads), return
any string you compute — e.g., read `package.json`, run git commands, etc.

## Configuration

### Test command for /ship

`/ship` needs to know your project's test command. It reads it from one of:

1. `CLAUDE.md` in the repo root (e.g., `bun test`, `npm test`, `pytest`)
2. `package.json` `"test"` script
3. `Makefile` `test:` target
4. Asks you interactively if none of the above exist

Best practice: add a `## Commands` section to your `CLAUDE.md`:

```markdown
## Commands

\`\`\`bash
pytest                    # run tests
pytest --cov              # with coverage
\`\`\`
```

### Base branch

Auto-detected from `git symbolic-ref refs/remotes/origin/HEAD`, falls back to `main`.
Works with `main`, `master`, `develop`, etc.

## What each skill does

### `/investigate` — root-cause debugging

Four-phase workflow: investigate → pattern match → hypothesize → fix → verify.
Iron law: **no fixes without root cause**. Includes 3-strike rule (3 failed
hypotheses → stop and ask about the architecture instead of a bug).

Use when: debugging a specific error, regression hunting, "why is this broken".

### `/review` — pre-landing PR review

Reads `checklist.md`, runs a two-pass review against `git diff origin/<base>`,
classifies findings as AUTO-FIX (mechanical) or ASK (judgment call), applies
auto-fixes directly, batches ASK items into a single question.

Use when: you want to check a branch before merging without running `/ship`.

### `/ship` — fully automated ship

Merges base → runs tests → runs `/review` logic → bumps VERSION → updates
CHANGELOG → splits commits for `git bisect` → pushes → creates PR via `gh`.
**Only stops for failures or genuine judgment calls** (MINOR/MAJOR version
bump, ambiguous ASK items from review).

Use when: code is ready to merge and you want zero friction.

Dependencies: `gh` CLI, git, and whatever your test command needs.

### `/retro` — weekly retrospective

Generates a 3000-4500 word team retrospective from git history: commit counts,
LOC breakdown, session detection (45-min gap threshold), per-author leaderboard
with praise + growth feedback, streak tracking, trend comparison vs prior retros.

Saves JSON snapshots to `.context/retros/` for trend tracking.

Use when: end of sprint, weekly review, "what did we ship".

## Design principles you're inheriting

These prompt-engineering patterns come from gstack and are worth understanding:

1. **Every skill re-grounds itself.** The preamble prints the current branch so
   the agent doesn't rely on stale context from the conversation.

2. **AskUserQuestion is never terse.** Re-ground → simplify → recommend → options.
   Assumes the user hasn't looked at the window in 20 minutes.

3. **Completeness over shortcuts.** The agent is explicitly told to recommend
   the complete implementation when AI makes the marginal cost near-zero.

4. **Fix-First instead of read-only.** Review skills don't just report — they
   apply mechanical fixes automatically and only ask about judgment calls.

5. **Bisectable commits by default.** `/ship` auto-splits changes into logical
   commits so `git bisect` remains useful.

6. **Verification gate before claims.** "Should work now" is not evidence.
   If code changed, re-run tests. Paste fresh output.

7. **3-strike escalation.** 3 failed attempts → STOP and question the approach.

## License

Inherited from gstack: MIT License, Copyright (c) 2026 Garry Tan.
Keep the copyright notice if you redistribute.

Original: https://github.com/twotrees1226/gstack
