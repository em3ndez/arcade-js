# Reviewer rules — process-compliance checklist

Hand this to EVERY commit's review agent, in addition to its correctness review. The reviewer
already checks correctness; these are the PROCESS rules that drift when only the lead watches
them. Check each against the STAGED diff (`git diff --cached`), `git log`, and the repo. Any
violation → WITHHOLD the review token and report `Rxx` + the exact file/line/evidence. Each rule
names how to verify it so the check is mechanical, not a matter of opinion.

Enforcement lives HERE — in the rules an independent review agent checks — not in bespoke gate
scripts. A gate can only test a proxy; the review agent can judge the actual requirement. (The
only always-on git hooks are the pre-existing `review_gate` / `names_consistency` / `clarify_gate`;
do not add more — express a new requirement as a rule below.)

First, classify this commit from its subject line:
  DECOMPILE  = "decompile batch N"      UNDERSTANDING = "understanding pass N"
  INFRA/DOC/FIX = anything else
Rules tagged [D]/[U]/[ALL] apply to that class.

## Cadence — the drift this list exists to stop
- **R1 [D]** No two DECOMPILE commits without an UNDERSTANDING commit between them.
  Verify: read `git log --format=%s` from newest; walking back from HEAD, an "understanding pass"
  commit must appear before you reach a second "decompile batch" (i.e. this decompile batch is not
  the second in a row with no understanding pass between them).

## Understanding passes must not be hollowed out (kept the cheap half, dropped grounding)
- **R2 [U]** Grounding is part of understanding, so the pass must DO grounding. But grounding is an
  ACTIVITY (run the real ROM under MAME, try to observe the candidate cells, record what was seen) —
  NOT an output count. An honest grounding run can lift ZERO cells to `[seen]` (a cell may not be
  observable in any reachable state). So do NOT require new `[seen]` lines; requiring them would
  reject a valid pass or pressure a fake/mislabel. Instead require EVIDENCE the grounding ran and was
  recorded honestly: a grounding report / run-log for this pass (e.g. `scratchpad/pass<N>-grounding.md`
  or a `grounding-results.md` entry) showing a real MAME run + per-cell verdicts — each candidate cell
  either LIFTED to `[seen]` (with the observed bytes) or kept `[code]`/marked debt WITH the specific
  reason it couldn't be observed. A pass that grounded and lifted nothing is VALID when the report
  documents why. FAIL only when there is no grounding activity at all — no report, no run. That, not
  a low lift-count, is the hollowing-out.
  Verify: locate this pass's grounding report; confirm it cites a real MAME command + observed bytes
  (not the JS engine, R3), covers the cells the pass touched, and gives a reason for every cell it
  says it could not ground.
- **R3 [ALL]** Every `[seen]` tag added/changed is backed by a REAL-ROM MAME observation, never the JS
  engine (that would be circular). Verify: the adjacent note cites a MAME/attract run.

## Naming — proposer ≠ confirmer
- **R4 [ALL]** Every routine promoted loc_<addr>→English this commit appears in BOTH a scratchpad
  proposals file AND a separate `pass<N>-confirmed.md` (distinct agents). Verify: grep both files
  for the new name.
- **R5 [ALL]** Every promoted name is corroborated by evidence OUTSIDE the routine itself (a named
  cell it touches, an idiomatic caller/callee, mechanisms.md, or a sibling), and the file header
  states that corroboration. Verify: read the renamed file's header.
- **R6 [ALL]** Where purpose is not corroborated, the routine STAYS loc_<addr>. A confidently-wrong
  English name is a violation. Verify: spot-check promoted names aren't guesses.

## Single source of truth (ram.js)
- **R7 [ALL]** No staged prose (routine comment or mechanisms.md) calls a cell that IS named in ram.js
  "unnamed / kept hex / no ram.js name". Verify: `python3 tools/names_consistency.py check` (also a
  hook) + scan comments in the diff.
- **R8 [ALL]** A cell named in ram.js is IMPORTED from ram.js, not redefined as a local hex const.
  Verify: grep the diff for `const [A-Z_0-9]+ = 0x6[0-9a-f]{3}` duplicating a ram.js name.
- **R16 [ALL]** Every named cell in ram.js carries a grounding rating. Verify by PARSING ram.js: for
  each `export const NAME = 0x…`, its own comment must contain `[seen]`, `[code]`, or `[guess]`.
  **FAIL if ANY named cell is unrated** — no ratchet, no legacy-debt exception. A name is not
  understanding; the registry is complete only when every cell is labeled.

## Translation conventions
- **R9 [ALL]** No import from `optimized/` (retired layer). Imports resolve from `./ram.js` and other
  idiomatic files. Verify: `git diff --cached | grep optimized/`.
- **R10 [ALL]** No idiomatic routine calls an already-idiomatic callee via `m.call(0xADDR…)`/push16
  (stale oracle leak) — idiomatic callees are direct JS calls. Verify: grep the diff for `m.call(0x`.
- **R11 [D]** Faithful-translation routines are named loc_<addr>; English names ONLY via a confirmed
  promotion (R4). Verify: new files in a decompile batch use address names unless promoted.

## Every routine gated with teeth
- **R12 [D]** Each new/changed routine has an equivalence test that (a) compares work-RAM to the
  frozen oracle, (b) asserts the routine's REAL live-out (return value too, not just RAM), and
  (c) has ≥1 broken-twin "teeth" case the test actually CATCHES. Verify: read the test; teeth
  assertions present and non-vacuous; run it if unsure.

## Staging & commit hygiene
- **R13 [ALL]** The staged diff contains ONLY files of this commit's stated unit — a DECOMPILE stages
  that batch's routines+tests; an UNDERSTANDING stages renames/ram.js/mechanisms/retrofits. No
  unrelated files, no cross-unit leak, no infra mixed in. Verify: `git diff --cached --stat` vs the
  stated scope.
- **R14 [ALL]** No `git mv` leaked another unit's renames into this index. Verify: every staged rename
  belongs to this unit.
- **R15 [ALL]** Commit authored by Jimmy; NO Co-Authored-By trailer; review_gate token bound to this
  exact staged diff; no `--no-verify`; no ROM/binary assets staged. Verify: author, trailer, token,
  staged file types.

Report format: for each class-applicable rule, `Rxx PASS` or `Rxx FAIL <evidence>`; record the token
only if ALL are PASS (plus the correctness review passes).

---

*History: R1/R2 began as a `cadence_gate.py` commit-msg hook and R16 as a `rating_completeness.py`
gate; both were deleted in favour of these rules. A gate tests a proxy (e.g. "≥1 new `[seen]` line");
a rule the review agent reads can require the real thing (grounding actually ran and was honestly
recorded). Add new requirements here, as rules — not as new gates.*
