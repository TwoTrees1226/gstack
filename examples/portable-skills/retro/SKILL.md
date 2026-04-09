---
name: retro
version: 2.0.0-portable
description: |
  Weekly engineering retrospective. Analyzes commit history, work patterns,
  and code quality metrics with persistent history and trend tracking.
  Team-aware: breaks down per-person contributions with praise and growth areas.
  Use when asked to "weekly retro", "what did we ship", or "engineering retrospective".
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: node scripts/gen-skill-docs.mjs -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
```

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch (use the `_BRANCH` value printed by the preamble — NOT any branch from conversation history), and the current plan/task. (1-2 sentences)
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow. No raw function names, no internal jargon. Use concrete examples and analogies. Say what it DOES, not what it's called.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]` — always prefer the complete option over shortcuts. Include `Completeness: X/10` for each option. 10 = complete implementation, 7 = happy path only, 3 = shortcut.
4. **Options:** Lettered options: `A) ... B) ... C) ...` — when an option involves effort, show both scales: `(human: ~X / AI: ~Y)`

Assume the user hasn't looked at this window in 20 minutes and doesn't have the code open. If you'd need to read the source to understand your own explanation, it's too complex.

## Completeness Principle — Boil the Lake

AI-assisted coding makes the marginal cost of completeness near-zero. When you present options:

- If Option A is the complete implementation (full parity, all edge cases) and Option B is a shortcut that saves modest effort — **always recommend A**. "Good enough" is the wrong instinct when "complete" costs minutes more with AI assistance.
- **Lake vs. ocean:** A "lake" is boilable — 100% test coverage for a module, full feature implementation, handling all edge cases. An "ocean" is not — rewriting an entire system, multi-quarter platform migrations. Recommend boiling lakes; flag oceans as out of scope.
- **When estimating effort**, show both scales: human team time and AI-assisted time. Compression varies by task:

| Task type | Human team | AI-assisted | Compression |
|-----------|-----------|-------------|-------------|
| Boilerplate / scaffolding | 2 days | 15 min | ~100x |
| Test writing | 1 day | 15 min | ~50x |
| Feature implementation | 1 week | 30 min | ~30x |
| Bug fix + regression test | 4 hours | 15 min | ~20x |
| Architecture / design | 2 days | 4 hours | ~5x |
| Research / exploration | 1 day | 3 hours | ~3x |

**Anti-patterns:**
- BAD: "Choose B — it covers 90% of the value with less code."
- BAD: "We can skip edge case handling to save time."
- BAD: "Let's defer test coverage to a follow-up PR."
- BAD: Quoting only human-team effort: "This would take 2 weeks."

## Search Before Building

Before building infrastructure, unfamiliar patterns, or anything the runtime might have a built-in — **search first.**

**Three layers of knowledge:**
- **Layer 1** (tried and true — in distribution). Don't reinvent the wheel.
- **Layer 2** (new and popular — search for these). Scrutinize: humans are subject to mania.
- **Layer 3** (first principles — prize these above all). Original observations.

**Eureka moment:** When first-principles reasoning reveals conventional wisdom is wrong, name it:
"EUREKA: Everyone does X because [assumption]. But [evidence] shows this is wrong. Y is better because [reasoning]."

If WebSearch is unavailable, skip the search step and note: "Search unavailable — proceeding with in-distribution knowledge only."

## Completion Status Protocol

When completing a skill workflow, report status using one of:
- **DONE** — All steps completed successfully. Evidence provided for each claim.
- **DONE_WITH_CONCERNS** — Completed, but with issues the user should know about.
- **BLOCKED** — Cannot proceed. State what is blocking and what was tried.
- **NEEDS_CONTEXT** — Missing information required to continue.

### Escalation

It is always OK to stop and say "this is too hard for me" or "I'm not confident in this result."
Bad work is worse than no work.
- If you have attempted a task 3 times without success, STOP and escalate.
- If you are uncertain about a security-sensitive change, STOP and escalate.
- If the scope of work exceeds what you can verify, STOP and escalate.

Escalation format:
```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentences]
ATTEMPTED: [what you tried]
RECOMMENDATION: [what the user should do next]
```

## Detect default branch

Before gathering data, detect the repo's default branch name:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null \
  || git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' \
  || echo "main"
```

Use the detected name wherever the instructions say `origin/<default>` below.

---

# /retro — Weekly Engineering Retrospective

Generates a comprehensive engineering retrospective analyzing commit history, work patterns, and code quality metrics. Team-aware: identifies the user running the command, then analyzes every contributor with per-person praise and growth opportunities.

## Arguments
- `/retro` — default: last 7 days
- `/retro 24h` — last 24 hours
- `/retro 14d` — last 14 days
- `/retro 30d` — last 30 days
- `/retro compare` — compare current window vs prior same-length window
- `/retro compare 14d` — compare with explicit window

## Instructions

Parse the argument to determine the time window. Default to 7 days. All times should be reported in the user's **local timezone** (do NOT set `TZ`).

**Midnight-aligned windows:** For day (`d`) and week (`w`) units, compute an absolute start date at local midnight. Example: if today is 2026-03-18 and the window is 7 days, use `--since="2026-03-11T00:00:00"` for git log queries. The `T00:00:00` suffix ensures git starts from midnight. For week units, multiply by 7. For hour (`h`) units, use `--since="N hours ago"`.

**Argument validation:** If the argument doesn't match `<N>[d|h|w]`, `compare`, or `compare <N>[d|h|w]`, show usage and stop.

### Step 1: Gather Raw Data

First, fetch origin and identify the current user:
```bash
git fetch origin <default> --quiet
git config user.name
git config user.email
```

The name returned by `git config user.name` is **"you"** — the person reading this retro. All other authors are teammates.

Run these git commands in parallel:

```bash
# 1. All commits with timestamps, author, files changed, insertions, deletions
git log origin/<default> --since="<window>" --format="%H|%aN|%ae|%ai|%s" --shortstat

# 2. Per-commit test vs total LOC breakdown with author
git log origin/<default> --since="<window>" --format="COMMIT:%H|%aN" --numstat

# 3. Commit timestamps for session detection and hourly distribution
git log origin/<default> --since="<window>" --format="%at|%aN|%ai|%s" | sort -n

# 4. Files most frequently changed (hotspot analysis)
git log origin/<default> --since="<window>" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn

# 5. PR numbers from commit messages
git log origin/<default> --since="<window>" --format="%s" | grep -oE '#[0-9]+' | sort -u

# 6. Per-author file hotspots
git log origin/<default> --since="<window>" --format="AUTHOR:%aN" --name-only

# 7. Per-author commit counts
git shortlog origin/<default> --since="<window>" -sn --no-merges

# 8. TODOS.md backlog (if available)
cat TODOS.md 2>/dev/null || true

# 9. Test file count
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' -o -name '*_spec.*' 2>/dev/null | grep -v node_modules | wc -l

# 10. Test files changed in window
git log origin/<default> --since="<window>" --format="" --name-only | grep -E '\.(test|spec)\.' | sort -u | wc -l
```

### Step 2: Compute Metrics

Calculate and present in a summary table:

| Metric | Value |
|--------|-------|
| Commits to main | N |
| Contributors | N |
| PRs merged | N |
| Total insertions | N |
| Total deletions | N |
| Net LOC added | N |
| Test LOC ratio | N% |
| Active days | N |
| Detected sessions | N |
| Avg LOC/session-hour | N |
| Test Health | N total tests · M added this period |

Show a **per-author leaderboard**:

```
Contributor         Commits   +/-          Top area
You (name)               32   +2400/-300   src/browse/
alice                    12   +800/-150    src/services/
bob                       3   +120/-40     tests/
```

Sort by commits descending. The current user (from `git config user.name`) always appears first, labeled "You (name)".

**Backlog Health (if TODOS.md exists):** Read TODOS.md. Compute total open TODOs, P0/P1 count, P2 count, items completed this period, items added this period.

### Step 3: Commit Time Distribution

Hourly histogram in local time:

```
Hour  Commits  ████████████████
 00:    4      ████
 07:    5      █████
```

Identify: peak hours, dead zones, bimodal vs continuous pattern, late-night clusters (after 10pm).

### Step 4: Work Session Detection

Detect sessions using **45-minute gap** threshold between consecutive commits. For each session report start/end time, commit count, duration.

Classify:
- **Deep sessions** (50+ min)
- **Medium sessions** (20-50 min)
- **Micro sessions** (<20 min)

Calculate total active coding time, average session length, LOC per hour.

### Step 5: Commit Type Breakdown

Categorize by conventional commit prefix (feat/fix/refactor/test/chore/docs). Show as percentage bar:

```
feat:     20  (40%)  ████████████████████
fix:      27  (54%)  ███████████████████████████
refactor:  2  ( 4%)  ██
```

Flag if fix ratio exceeds 50% — signals a "ship fast, fix fast" pattern that may indicate review gaps.

### Step 6: Hotspot Analysis

Show top 10 most-changed files. Flag:
- Files changed 5+ times (churn hotspots)
- Test vs production file mix in the hotspot list
- VERSION/CHANGELOG frequency

### Step 7: PR Size Distribution

Bucket PRs by size: Small (<100 LOC), Medium (100-500), Large (500-1500), XL (1500+).

### Step 8: Focus Score + Ship of the Week

**Focus score:** Percentage of commits touching the single most-changed top-level directory. Higher = deeper focused work. Report: "Focus score: 62% (src/services/)"

**Ship of the week:** Auto-identify the single highest-LOC PR. Highlight PR number, title, LOC changed, why it matters.

### Step 9: Team Member Analysis

For each contributor (including current user), compute:
1. Commits and LOC
2. Areas of focus (top 3 directories)
3. Commit type mix
4. Session patterns
5. Test discipline (personal test LOC ratio)
6. Biggest ship

**For the current user ("You"):** Deepest treatment. First person: "Your peak hours...", "Your biggest ship..."

**For each teammate:** 2-3 sentences on what they worked on. Then:
- **Praise** (1-2 specific things): Anchor in actual commits. Not "great work" — say exactly what was good.
- **Opportunity for growth** (1 specific thing): Frame as leveling-up, not criticism. Anchor in data.

**If solo repo:** Skip team breakdown.

**Co-Authored-By trailers:** Credit those authors alongside the primary author. Note AI co-authors (e.g., `noreply@anthropic.com`) as "AI-assisted commits" metric, not as team members.

### Step 10: Week-over-Week Trends (if window >= 14d)

Split into weekly buckets. Show: commits/week, LOC/week, test ratio/week, fix ratio/week, session count/week.

### Step 11: Streak Tracking

Count consecutive days with at least 1 commit to `origin/<default>`. Track both team streak and personal streak:

```bash
# Team streak
git log origin/<default> --format="%ad" --date=format:"%Y-%m-%d" | sort -u

# Personal streak
git log origin/<default> --author="<user_name>" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

Count backward from today. Display both:
- "Team shipping streak: 47 consecutive days"
- "Your shipping streak: 32 consecutive days"

### Step 12: Load History & Compare

Before saving the new snapshot, check for prior retro history:

```bash
ls -t .context/retros/*.json 2>/dev/null
```

**If prior retros exist:** Load the most recent. Calculate deltas and include a **Trends vs Last Retro** section:
```
                    Last        Now         Delta
Test ratio:         22%    →    41%         ↑19pp
Sessions:           10     →    14          ↑4
LOC/hour:           200    →    350         ↑75%
Fix ratio:          54%    →    30%         ↓24pp (improving)
Commits:            32     →    47          ↑47%
```

**If no prior retros exist:** Skip comparison. Append: "First retro recorded — run again next week to see trends."

### Step 13: Save Retro History

After computing all metrics, save a JSON snapshot:

```bash
mkdir -p .context/retros
```

Determine next sequence number:
```bash
today=$(date +%Y-%m-%d)
existing=$(ls .context/retros/${today}-*.json 2>/dev/null | wc -l | tr -d ' ')
next=$((existing + 1))
# Save as .context/retros/${today}-${next}.json
```

JSON schema:
```json
{
  "date": "2026-03-08",
  "window": "7d",
  "metrics": {
    "commits": 47,
    "contributors": 3,
    "prs_merged": 12,
    "insertions": 3200,
    "deletions": 800,
    "net_loc": 2400,
    "test_loc": 1300,
    "test_ratio": 0.41,
    "active_days": 6,
    "sessions": 14,
    "deep_sessions": 5,
    "avg_session_minutes": 42,
    "loc_per_session_hour": 350,
    "feat_pct": 0.40,
    "fix_pct": 0.30,
    "peak_hour": 22,
    "ai_assisted_commits": 32
  },
  "authors": {
    "Your Name": { "commits": 32, "insertions": 2400, "deletions": 300, "test_ratio": 0.41, "top_area": "src/" }
  },
  "streak_days": 47,
  "tweetable": "Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm"
}
```

Include `test_health` and `backlog` fields only if data exists; otherwise omit.

### Step 14: Write the Narrative

**Tweetable summary** (first line):
```
Week of Mar 1: 47 commits (3 contributors), 3.2k LOC, 38% tests, 12 PRs, peak: 10pm | Streak: 47d
```

Structure:
- **Summary Table** (Step 2)
- **Trends vs Last Retro** (Step 12, skip if first retro)
- **Time & Session Patterns** (Steps 3-4) — what productive hours reveal, session length trend, team rhythm
- **Shipping Velocity** (Steps 5-7) — commit mix, PR size distribution, fix-chain detection
- **Code Quality Signals** — test ratio trend, hotspot churn
- **Test Health** — total tests, tests added this period; if ratio < 20%, flag as growth area
- **Focus & Highlights** (Step 8) — focus score, ship of the week
- **Your Week** (personal deep-dive for current user)
- **Team Breakdown** (for each teammate, skip if solo)
- **Top 3 Team Wins** — 3 highest-impact ships with who/why
- **3 Things to Improve** — specific, actionable, anchored in commits
- **3 Habits for Next Week** — small, realistic, <5 minutes to adopt
- **Week-over-Week Trends** (if window >= 14d)

## Compare Mode

When the user runs `/retro compare` (or `/retro compare 14d`):

1. Compute metrics for the current window (default 7d) using midnight-aligned start date
2. Compute metrics for the immediately prior same-length window using both `--since` and `--until` with midnight-aligned dates
3. Show side-by-side comparison table with deltas and arrows
4. Brief narrative highlighting biggest improvements and regressions
5. Save only the current-window snapshot

## Tone

- Encouraging but candid, no coddling
- Specific and concrete — always anchor in actual commits
- Skip generic praise — say exactly what was good and why
- Frame improvements as leveling up, not criticism
- Praise should feel like something you'd say in a 1:1 — specific, earned
- Growth suggestions should feel like investment advice, not criticism
- Never compare teammates negatively
- Total output: 3000-4500 words
- Use markdown tables/code blocks for data, prose for narrative
- Output directly to the conversation — ONLY file written is the `.context/retros/` JSON snapshot

## Important Rules

- ALL narrative output goes directly to the user in the conversation
- Use `origin/<default>` for all git queries (not local main which may be stale)
- Display all timestamps in the user's local timezone
- If the window has zero commits, say so and suggest a different window
- Round LOC/hour to nearest 50
- Treat merge commits as PR boundaries
- This skill is self-contained — do not read CLAUDE.md or other docs
- On first run (no prior retros), skip comparison sections gracefully
