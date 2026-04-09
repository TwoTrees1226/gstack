---
name: ship
version: 1.0.0-portable
description: |
  Ship workflow: detect + merge base branch, run tests, review diff, bump VERSION,
  update CHANGELOG, commit, push, create PR. Use when asked to "ship", "deploy",
  "push to main", "create a PR", or "merge and push".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
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

# Ship: Fully Automated Ship Workflow

You are running the `/ship` workflow. This is a **non-interactive, fully automated** workflow. Do NOT ask for confirmation at any step. The user said `/ship` which means DO IT. Run straight through and output the PR URL at the end.

**Only stop for:**
- On the base branch (abort)
- Merge conflicts that can't be auto-resolved (stop, show conflicts)
- Test failures (stop, show failures)
- Pre-landing review finds ASK items that need user judgment
- MINOR or MAJOR version bump needed (ask — see Step 4)
- TODOS.md missing and user wants to create one (ask — see Step 5.5)

**Never stop for:**
- Uncommitted changes (always include them)
- Version bump choice (auto-pick MICRO or PATCH — see Step 4)
- CHANGELOG content (auto-generate from diff)
- Commit message approval (auto-commit)
- Multi-file changesets (auto-split into bisectable commits)
- Auto-fixable review findings (dead code, N+1, stale comments — fixed automatically)

---

## Step 1: Pre-flight

1. Check the current branch. If on the base branch or the repo's default branch, **abort**: "You're on the base branch. Ship from a feature branch."

2. Run `git status` (never use `-uall`). Uncommitted changes are always included.

3. Run `git diff <base>...HEAD --stat` and `git log <base>..HEAD --oneline` to understand what's being shipped.

---

## Step 2: Merge the base branch (BEFORE tests)

Fetch and merge the base into the feature branch so tests run against the merged state:

```bash
git fetch origin <base> && git merge origin/<base> --no-edit
```

**If there are merge conflicts:** Try to auto-resolve simple ones (VERSION, CHANGELOG ordering). If conflicts are complex or ambiguous, **STOP** and show them.

**If already up to date:** Continue silently.

---

## Step 3: Run tests

Read `CLAUDE.md` (or project README) to find the test command. If no test command is defined:
- Check `package.json` for `"test"` script
- Check `Makefile` for `test` target
- Check for `pytest`, `cargo test`, `go test`, `bin/test`
- If still nothing, use AskUserQuestion to ask the user for the test command and offer to persist it to CLAUDE.md.

Run the test command. Capture output.

**If any test fails:** Show failures and **STOP**. Do not proceed.

**If all pass:** Note the counts briefly and continue.

---

## Step 3.5: Pre-Landing Review

Review the diff for structural issues that tests don't catch.

1. Read `checklist.md` from the adjacent `review/` skill directory. If the file cannot be read, **STOP** and report the error.

2. Run `git diff origin/<base>` to get the full diff.

3. Apply the review checklist in two passes:
   - **Pass 1 (CRITICAL):** SQL & Data Safety, Race Conditions, Trust Boundary Violations, Enum Completeness
   - **Pass 2 (INFORMATIONAL):** All remaining categories

4. **Classify each finding as AUTO-FIX or ASK** per the Fix-First Heuristic in checklist.md. Critical findings lean toward ASK; informational lean toward AUTO-FIX.

5. **Auto-fix all AUTO-FIX items.** Output one line per fix:
   `[AUTO-FIXED] [file:line] Problem → what you did`

6. **If ASK items remain,** present them in ONE AskUserQuestion:
   - List each with number, severity, problem, recommended fix
   - Per-item options: A) Fix  B) Skip
   - Overall RECOMMENDATION

7. **After all fixes:**
   - If ANY fixes were applied: commit fixed files by name, then **STOP** and tell the user to run `/ship` again to re-test.
   - If no fixes applied: continue to Step 4.

8. Output summary: `Pre-Landing Review: N issues — M auto-fixed, K asked (J fixed, L skipped)`

Save the review output — it goes into the PR body in Step 8.

---

## Step 4: Version bump (auto-decide)

1. Read the current `VERSION` file (4-digit format: `MAJOR.MINOR.PATCH.MICRO`). If no VERSION file exists, skip this step.

2. **Auto-decide the bump level based on the diff:**
   - Count lines changed (`git diff origin/<base>...HEAD --stat | tail -1`)
   - **MICRO** (4th digit): < 50 lines changed, trivial tweaks, typos, config
   - **PATCH** (3rd digit): 50+ lines changed, bug fixes, small-medium features
   - **MINOR** (2nd digit): **ASK the user** — only for major features or significant architectural changes
   - **MAJOR** (1st digit): **ASK the user** — only for milestones or breaking changes

3. Compute the new version. Bumping a digit resets all digits to its right to 0. Example: `0.19.1.0` + PATCH → `0.19.2.0`.

4. Write the new version to the `VERSION` file.

---

## Step 5: CHANGELOG (auto-generate)

1. Read `CHANGELOG.md` header to know the format. If no CHANGELOG.md exists, skip this step.

2. Auto-generate the entry from **ALL commits on the branch**:
   - Use `git log <base>..HEAD --oneline` to see every commit being shipped
   - Use `git diff <base>...HEAD` to see the full diff against base
   - The CHANGELOG entry must be comprehensive of ALL changes going into the PR
   - Categorize changes:
     - `### Added` — new features
     - `### Changed` — changes to existing functionality
     - `### Fixed` — bug fixes
     - `### Removed` — removed features
   - Write concise, descriptive bullet points
   - Insert after the file header, dated today
   - Format: `## [X.Y.Z.W] - YYYY-MM-DD`

**Do NOT ask the user to describe changes.** Infer from the diff and commit history.

---

## Step 5.5: TODOS.md (auto-update, optional)

If `TODOS.md` exists in the repo root, cross-reference it against the changes being shipped. Mark completed items automatically.

For each TODO item, check if the changes in this PR complete it by:
- Matching commit messages against the TODO title and description
- Checking if files referenced in the TODO appear in the diff
- Checking if the TODO's described work matches the functional changes

**Be conservative:** Only mark a TODO as completed if there is clear evidence in the diff.

Move completed items to a `## Completed` section at the bottom. Append: `**Completed:** vX.Y.Z (YYYY-MM-DD)`

If TODOS.md doesn't exist, skip this step silently.

---

## Step 6: Commit (bisectable chunks)

**Goal:** Create small, logical commits that work well with `git bisect`.

1. Analyze the diff and group changes into logical commits. Each commit = **one coherent change**.

2. **Commit ordering** (earlier first):
   - Infrastructure: migrations, config, route additions
   - Models & services (with their tests)
   - Controllers & views (with their tests)
   - VERSION + CHANGELOG + TODOS.md: always in the final commit

3. **Rules for splitting:**
   - A model and its test file go in the same commit
   - A service and its test file go in the same commit
   - A controller, its views, and its test go in the same commit
   - Migrations are their own commit (or grouped with their model)
   - If total diff is small (< 50 lines across < 4 files), a single commit is fine

4. **Each commit must be independently valid** — no broken imports, no references to code that doesn't exist yet.

5. Compose each commit message:
   - First line: `<type>: <summary>` (type = feat/fix/chore/refactor/docs)
   - Body: brief description
   - Only the **final commit** gets the version tag

---

## Step 6.5: Verification Gate

**IRON LAW: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.**

Before pushing, re-verify if code changed during Steps 4-6:

1. **Test verification:** If ANY code changed after Step 3's test run, re-run the test suite. Paste fresh output. Stale output is NOT acceptable.

2. **Build verification:** If the project has a build step, run it. Paste output.

3. **Rationalization prevention:**
   - "Should work now" → RUN IT.
   - "I'm confident" → Confidence is not evidence.
   - "I already tested earlier" → Code changed since then. Test again.
   - "It's a trivial change" → Trivial changes break production.

**If tests fail here:** STOP. Do not push. Fix and return to Step 3.

---

## Step 7: Push

```bash
git push -u origin <branch-name>
```

---

## Step 8: Create PR

Create a pull request using `gh`:

```bash
gh pr create --base <base> --title "<type>: <summary>" --body "$(cat <<'EOF'
## Summary
<bullet points from CHANGELOG>

## Pre-Landing Review
<findings from Step 3.5, or "No issues found.">

## Test plan
- [x] All tests pass (N tests, 0 failures)
EOF
)"
```

**Output the PR URL.**

---

## Important Rules

- **Never skip tests.** If tests fail, stop.
- **Never skip the pre-landing review.** If checklist.md is unreadable, stop.
- **Never force push.** Use regular `git push` only.
- **Never ask for trivial confirmations** (e.g., "ready to push?", "create PR?"). DO stop for: version bumps (MINOR/MAJOR), pre-landing review ASK items.
- **Always use the 4-digit version format** from the VERSION file (if it exists).
- **Date format in CHANGELOG:** `YYYY-MM-DD`
- **Split commits for bisectability** — each commit = one logical change.
- **Never push without fresh verification evidence.**
- **The goal is: user says `/ship`, next thing they see is the review + PR URL.**
