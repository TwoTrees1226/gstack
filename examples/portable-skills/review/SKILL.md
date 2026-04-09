---
name: review
version: 1.0.0-portable
description: |
  Pre-landing PR review. Analyzes diff against the base branch for SQL safety,
  race conditions, trust boundary violations, and other structural issues.
  Use when asked to "review this PR", "code review", "pre-landing review",
  or "check my diff".
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
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

## Detect base branch

```bash
_BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
echo "BASE_BRANCH: $_BASE"
```

Use the `_BASE` value wherever the instructions say `<base>`.

---

# Pre-Landing PR Review

You are running the `/review` workflow. Analyze the current branch's diff against the base branch for structural issues that tests don't catch.

---

## Step 1: Check branch

1. Run `git branch --show-current` to get the current branch.
2. If on the base branch, output: **"Nothing to review — you're on the base branch or have no changes against it."** and stop.
3. Run `git fetch origin <base> --quiet && git diff origin/<base> --stat` to check if there's a diff. If no diff, output the same message and stop.

---

## Step 1.5: Scope Drift Detection

Before reviewing code quality, check: **did they build what was requested — nothing more, nothing less?**

1. Read `TODOS.md` (if it exists). Read PR description if one exists. Read commit messages: `git log origin/<base>..HEAD --oneline`.
2. Identify the **stated intent** — what was this branch supposed to accomplish?
3. Run `git diff origin/<base> --stat` and compare files changed against the stated intent.
4. Evaluate with skepticism:

   **SCOPE CREEP detection:**
   - Files changed that are unrelated to the stated intent
   - New features or refactors not mentioned in the plan
   - "While I was in there..." changes that expand blast radius

   **MISSING REQUIREMENTS detection:**
   - Requirements from TODOS.md/PR description not addressed in the diff
   - Test coverage gaps for stated requirements
   - Partial implementations (started but not finished)

5. Output:
   ```
   Scope Check: [CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING]
   Intent: <1-line summary of what was requested>
   Delivered: <1-line summary of what the diff actually does>
   [If drift: list each out-of-scope change]
   [If missing: list each unaddressed requirement]
   ```

6. This is **INFORMATIONAL** — does not block the review.

---

## Step 2: Read the checklist

Read `checklist.md` (adjacent to this SKILL.md).

**If the file cannot be read, STOP and report the error.**

---

## Step 3: Get the diff

```bash
git fetch origin <base> --quiet
git diff origin/<base>
```

This includes both committed and uncommitted changes against the latest base branch.

---

## Step 4: Two-pass review

Apply the checklist against the diff in two passes:

1. **Pass 1 (CRITICAL):** SQL & Data Safety, Race Conditions & Concurrency, Trust Boundary Violations (LLM/user input), Enum & Value Completeness
2. **Pass 2 (INFORMATIONAL):** Conditional Side Effects, Magic Numbers & String Coupling, Dead Code & Consistency, Test Gaps, View/Frontend, Performance & Bundle Impact

**Enum & Value Completeness requires reading code OUTSIDE the diff.** When the diff introduces a new enum value, status, tier, or type constant, use Grep to find all files that reference sibling values, then Read those files to check if the new value is handled.

**Search-before-recommending:** When recommending a fix pattern (especially for concurrency, caching, auth, or framework-specific behavior): verify it's current best practice for the framework version in use; check if a built-in solution exists in newer versions; verify API signatures against current docs. Takes seconds, prevents recommending outdated patterns.

---

## Step 5: Fix-First Review

**Every finding gets action — not just critical ones.**

Output summary header: `Pre-Landing Review: N issues (X critical, Y informational)`

### Step 5a: Classify each finding

For each finding, classify as AUTO-FIX or ASK:
- **AUTO-FIX** (apply directly): Mechanical fixes where intent is unambiguous — dead code removal, stale comments, trivial syntax, straightforward null guards, import cleanup.
- **ASK** (require user input): Anything requiring judgment — architectural changes, security-sensitive logic, race-condition fixes with behavioral trade-offs, anything that might break behavior.

Critical findings lean toward ASK; informational findings lean toward AUTO-FIX.

### Step 5b: Auto-fix all AUTO-FIX items

Apply each fix directly. For each one, output a one-line summary:
`[AUTO-FIXED] [file:line] Problem → what you did`

### Step 5c: Batch-ask about ASK items

If there are ASK items remaining, present them in ONE AskUserQuestion:

- List each item with a number, severity label, problem, and recommended fix
- Per-item options: A) Fix as recommended, B) Skip
- Include an overall RECOMMENDATION

Example:
```
I auto-fixed 5 issues. 2 need your input:

1. [CRITICAL] app/models/post.rb:42 — Race condition in status transition
   Fix: Add `WHERE status = 'draft'` to the UPDATE
   → A) Fix  B) Skip

2. [INFORMATIONAL] app/services/generator.rb:88 — LLM output not type-checked before DB write
   Fix: Add JSON schema validation
   → A) Fix  B) Skip

RECOMMENDATION: Fix both — #1 is a real race condition, #2 prevents silent data corruption.
```

If 3 or fewer ASK items, you may use individual AskUserQuestion calls instead of batching.

### Step 5d: Apply user-approved fixes

Apply fixes for items where the user chose "Fix." Output what was fixed.

### Verification of claims

Before producing the final review output:
- If you claim "this pattern is safe" → cite the specific line proving safety
- If you claim "this is handled elsewhere" → read and cite the handling code
- If you claim "tests cover this" → name the test file and method
- Never say "likely handled" or "probably tested" — verify or flag as unknown

**Rationalization prevention:** "This looks fine" is not a finding. Either cite evidence it IS fine, or flag it as unverified.

---

## Step 5.5: TODOS cross-reference

Read `TODOS.md` in the repository root (if it exists). Cross-reference the PR against open TODOs:

- **Does this PR close any open TODOs?** Note which: "This PR addresses TODO: <title>"
- **Does this PR create work that should become a TODO?** Flag as informational finding.
- **Are there related TODOs that provide context?** Reference them in related findings.

If TODOS.md doesn't exist, skip silently.

---

## Step 5.6: Documentation staleness check

Cross-reference the diff against documentation files. For each `.md` file in the repo root (README.md, ARCHITECTURE.md, CONTRIBUTING.md, CLAUDE.md, etc.):

1. Check if code changes in the diff affect features/components/workflows described in that doc.
2. If the doc was NOT updated in this branch but the code it describes WAS changed, flag as INFORMATIONAL:
   "Documentation may be stale: [file] describes [feature] but code changed in this branch."

Informational only — never critical.

---

## Important Rules

- **Read the FULL diff before commenting.** Do not flag issues already addressed in the diff.
- **Fix-first, not read-only.** AUTO-FIX items are applied directly. ASK items only after user approval. Never commit, push, or create PRs — that's /ship's job.
- **Be terse.** One line problem, one line fix. No preamble.
- **Only flag real problems.** Skip anything that's fine.
