# Pre-Landing Review Checklist

## Instructions

Review the `git diff origin/<base>` output for the issues listed below. Be specific — cite `file:line` and suggest fixes. Skip anything that's fine. Only flag real problems.

**Two-pass review:**
- **Pass 1 (CRITICAL):** SQL & Data Safety, Race Conditions, Trust Boundary, Enum Completeness. Highest severity.
- **Pass 2 (INFORMATIONAL):** All remaining categories. Lower severity but still actioned.

All findings get action via Fix-First Review: obvious mechanical fixes are applied automatically, genuinely ambiguous issues are batched into a single user question.

**Output format:**

```
Pre-Landing Review: N issues (X critical, Y informational)

**AUTO-FIXED:**
- [file:line] Problem → fix applied

**NEEDS INPUT:**
- [file:line] Problem description
  Recommended fix: suggested fix
```

If no issues found: `Pre-Landing Review: No issues found.`

Be terse. For each issue: one line describing the problem, one line with the fix. No preamble, no summaries, no "looks good overall."

---

## Review Categories

### Pass 1 — CRITICAL

#### SQL & Data Safety
- String interpolation in SQL (even if values are cast to int/float — use parameterized queries: Rails `sanitize_sql_array`/Arel; Node prepared statements; Python parameterized; Prisma typed queries)
- TOCTOU races: check-then-set patterns that should be atomic `WHERE` + update
- Bypassing model validations for direct DB writes (Rails `update_column`; Django `QuerySet.update()`; Prisma raw queries)
- N+1 queries: Missing eager loading (Rails `.includes()`; SQLAlchemy `joinedload()`; Prisma `include`) for associations used in loops/views

#### Race Conditions & Concurrency
- Read-check-write without uniqueness constraint or without catching duplicate-key errors
- find-or-create without a unique DB index — concurrent calls can create duplicates
- Status transitions without atomic `WHERE old_status = ? UPDATE SET new_status` — concurrent updates can skip or double-apply transitions
- Unsafe HTML rendering (`html_safe`/`raw()`, `dangerouslySetInnerHTML`, `v-html`, `|safe`/`mark_safe`) on user-controlled data (XSS)

#### Trust Boundary Violations (LLM / user input)
- LLM-generated values (emails, URLs, names) written to DB or passed to mailers without format validation. Add lightweight guards (regex, URI parsing, strip/sanitize) before persisting.
- Structured tool output (arrays, hashes) accepted without type/shape checks before database writes.
- User input flowing into SQL, shell commands, file paths, or HTML without sanitization.

#### Enum & Value Completeness
When the diff introduces a new enum value, status string, tier name, or type constant:
- **Trace it through every consumer.** Read (don't just grep — READ) each file that switches on, filters by, or displays that value. Common miss: adding a value to the frontend dropdown but the backend model/compute method doesn't persist it.
- **Check allowlists/filter arrays.** Search for arrays containing sibling values.
- **Check `case`/`if-elsif` chains.** Does the new value fall through to a wrong default?

This step requires reading code OUTSIDE the diff. Use Grep to find all references to the sibling values, then Read each match.

### Pass 2 — INFORMATIONAL

#### Conditional Side Effects
- Code paths that branch on a condition but forget to apply a side effect on one branch.
- Log messages that claim an action happened but the action was conditionally skipped. The log should reflect what actually occurred.

#### Magic Numbers & String Coupling
- Bare numeric literals used in multiple files — should be named constants
- Error message strings used as query filters elsewhere (grep for the string — is anything matching on it?)

#### Dead Code & Consistency
- Variables assigned but never read
- Version mismatch between PR title and VERSION/CHANGELOG files
- CHANGELOG entries that describe changes inaccurately
- Comments/docstrings that describe old behavior after the code changed

#### LLM Prompt Issues
- 0-indexed lists in prompts (LLMs reliably return 1-indexed)
- Prompt text listing available tools/capabilities that don't match what's actually wired up
- Word/token limits stated in multiple places that could drift

#### Test Gaps
- Negative-path tests that assert type/status but not side effects
- Assertions on string content without checking format
- Missing "never called" expectations when a code path should explicitly NOT call an external service
- Security enforcement (blocking, rate limiting, auth) without integration tests verifying the enforcement path

#### Completeness Gaps
- Shortcut implementations where the complete version would cost <30 minutes AI time
- Options presented with only human-team effort estimates — should show both human and AI-assisted time
- Test coverage gaps where the missing tests are a "lake" not an "ocean"
- Features implemented at 80-90% when 100% is achievable with modest additional code

#### Crypto & Entropy
- Truncation of data instead of hashing (less entropy, easier collisions)
- `rand()` / `Math.random()` for security-sensitive values — use a CSPRNG (`SecureRandom`, `crypto.randomBytes`, `secrets`)
- Non-constant-time comparisons (`==`) on secrets or tokens — vulnerable to timing attacks

#### Time Window Safety
- Date-key lookups that assume "today" covers 24h — a report at 8am only sees midnight→8am under today's key
- Mismatched time windows between related features (one uses hourly buckets, another uses daily keys for the same data)

#### Type Coercion at Boundaries
- Values crossing language/serialization boundaries where type could change (numeric vs string) — hash/digest inputs must normalize types
- Hash/digest inputs that don't normalize before serialization — `{ cores: 8 }` vs `{ cores: "8" }` produce different hashes

#### View/Frontend
- Inline `<style>` blocks in partials (re-parsed every render)
- O(n*m) lookups in views (find-in-loop instead of index hash)
- In-memory filtering on DB results that could be a `WHERE` clause

#### Performance & Bundle Impact
- New `dependencies` entries that are known-heavy: moment.js (→ date-fns), lodash full (→ per-function imports), jquery, core-js full polyfill
- Significant lockfile growth from a single addition
- Images added without `loading="lazy"` or explicit width/height (causes CLS)
- Large static assets committed to repo (>500KB per file)
- Synchronous `<script>` tags without async/defer
- CSS `@import` in stylesheets (blocks parallel loading)
- `useEffect` with fetch that depends on another fetch result (request waterfall)
- Named → default import switches on tree-shakeable libraries (breaks tree-shaking)

**DO NOT flag:**
- devDependencies additions (don't affect production bundle)
- Dynamic `import()` calls (code splitting — these are good)
- Small utility additions (<5KB gzipped)
- Server-side-only dependencies

---

## Severity Classification

```
CRITICAL (highest severity):      INFORMATIONAL (lower severity):
├─ SQL & Data Safety              ├─ Conditional Side Effects
├─ Race Conditions & Concurrency  ├─ Magic Numbers & String Coupling
├─ Trust Boundary Violations      ├─ Dead Code & Consistency
└─ Enum & Value Completeness      ├─ LLM Prompt Issues
                                  ├─ Test Gaps
                                  ├─ Completeness Gaps
                                  ├─ Crypto & Entropy
                                  ├─ Time Window Safety
                                  ├─ Type Coercion at Boundaries
                                  ├─ View/Frontend
                                  └─ Performance & Bundle Impact
```

All findings are actioned via Fix-First Review. Critical findings lean toward ASK (riskier), informational toward AUTO-FIX (more mechanical).

---

## Fix-First Heuristic

```
AUTO-FIX (agent fixes without asking):     ASK (needs human judgment):
├─ Dead code / unused variables            ├─ Security (auth, XSS, injection)
├─ N+1 queries (missing eager loading)     ├─ Race conditions
├─ Stale comments contradicting code       ├─ Design decisions
├─ Magic numbers → named constants         ├─ Large fixes (>20 lines)
├─ Missing LLM output validation           ├─ Enum completeness
├─ Version/path mismatches                 ├─ Removing functionality
├─ Variables assigned but never read       └─ Anything changing user-visible
└─ Inline styles, O(n*m) view lookups        behavior
```

**Rule of thumb:** If the fix is mechanical and a senior engineer would apply it without discussion, it's AUTO-FIX. If reasonable engineers could disagree, it's ASK.

**Critical findings default toward ASK. Informational findings default toward AUTO-FIX.**

---

## Suppressions — DO NOT flag these

- Harmless redundancy that aids readability (e.g., explicit guard beside an implicit one)
- "Add a comment explaining why this threshold was chosen" — thresholds change, comments rot
- "This assertion could be tighter" when the assertion already covers the behavior
- Consistency-only changes (wrapping a value in a conditional just to match another)
- "Regex doesn't handle edge case X" when the input is constrained and X never occurs in practice
- "Test exercises multiple guards simultaneously" — tests don't need to isolate every guard
- Harmless no-ops
- **ANYTHING already addressed in the diff you're reviewing** — read the FULL diff before commenting
