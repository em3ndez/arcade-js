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

- **R18 [U]** An understanding/naming pass must state HOW MANY routines remain unnamed
  and WHY — and "why" must rest on a REACHABILITY MEASUREMENT, not on an impression. Before a pass
  reports any routine as blocked, held, or hard, the backlog must have been swept: a read tap at
  each unnamed entry address on the real ROM under MAME, driven across boards/levels/difficulty,
  with hit counts attributed to the live game state (see grounding.md, "Triage the backlog FIRST").
  The pass must name at least one blocked cluster its run actually attacked.
  Verify:
  1. The pass reports an unnamed COUNT, and it matches the registry — re-derive it.
  2. A reachability sweep exists for this pass, with its script and run parameters cited AND
     REACHABLE by the reviewer — an artifact in a session scratchpad that no later reader can
     open is not a citation. An assertion that routines are "not reachable" or "nothing grounds
     them", with no sweep behind it, FAILS. This is the whole point of the rule.
  3. Any not-reached set is stated as "not reached by THIS sweep", with the states the sweep did
     NOT drive named (deliberate death, full prize collection, two-player, each difficulty tier
     ACTUALLY reached rather than merely nominally set). A not-reached set presented as a dead-code
     measurement FAILS. Measured cost of skipping this on DK: a second sweep adding those states
     reached 7 of a 21-entry not-reached list, so the first list overstated dead code by 50%.
  4. A dead-code claim about a specific routine is corroborated by a SECOND, independent method
     (typically a code derivation) — execution data alone is not sufficient, and neither is code
     alone. AND THE TWO METHODS MUST ANSWER THE SAME QUESTION. DK's loc_16d0 was reported as
     corroborated because a sweep found it unreached while a confirmer derived that its one write
     is dead; those are different claims, and a later sweep found the routine executing 107 times.
     Two results pointing the same way are not corroboration until you have checked they are about
     the same thing.
  5. The pass names at least one blocked cluster its run actually attacked, and what it found —
     a pass that reports only a count has not shown it engaged with the backlog it is describing.

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
  (stale oracle leak) — idiomatic callees are direct JS calls.
  THE DEFECT HAS TWO FORMS AND THE RECIPE MUST CHECK BOTH. The registry form is the obvious one; the
  other is a direct ES import of the frozen oracle — `import { loc_30bd } from "../translated/loc_30bd.js";
  // no idiomatic yet` — in a file where the idiomatic twin DOES exist and that address IS in
  ROUTINES. Same leak, and the comment beside it is false as well.
  Verify (both, per game touched):
  1. `git diff --cached | grep 'm\.call(0x'` — any hit whose target address is a key of that game's
     `games/<game>/idiomatic/ram.js` ROUTINES map FAILS.
  2. Resolve every `from "../translated/loc_XXXX.js"` import in the staged idiomatic files against
     the same ROUTINES map; any whose address is present FAILS. Game-agnostic one-liner:
     ```sh
     GAME=<game> node --input-type=module -e '
     import { readdirSync, readFileSync } from "node:fs";
     const d = `games/${process.env.GAME}/idiomatic`;
     const { ROUTINES } = await import(`./${d}/ram.js`);
     for (const f of readdirSync(d).filter((x) => x.endsWith(".js")))
       for (const m of readFileSync(`${d}/${f}`, "utf8").matchAll(/from "\.\.\/translated\/loc_([0-9a-f]{4})\.js"/g))
         if (ROUTINES[parseInt(m[1], 16)])
           console.log(`${f}: imports translated/loc_${m[1]}.js but ${ROUTINES[parseInt(m[1], 16)].name} is idiomatic`);'
     ```
     It scans the whole tree, so judge only the files THIS commit stages; pre-existing hits are a
     separate cleanup unit (26 stood in games/dkong/idiomatic as of 2026-08-02).
  WHY A RULE AND NOT A GATE, and why this rule is load-bearing: a stale oracle reference is
  invisible to the equivalence gate BY CONSTRUCTION — the oracle is correct, so calling it produces
  correct RAM and every test stays green. Nothing else in the pipeline can see it. This rule is the
  only thing standing between the codebase and silent readability rot, which is the same argument
  R17 rests on.
- **R11 [D]** Every UNNAMED idiomatic routine is named `loc_<addr>` — NEVER a cute prefix
  (`sub_`/`handler_`/`entry_`/`draw_`/`branch_`/`tail_`/`guard_`) or an English name, EVEN when the
  frozen `translated/` oracle carries such a name (DK's oracle does; do not mirror it into idiomatic).
  English names come ONLY via a confirmed understanding-pass promotion (R4). Verify: a new decompile
  batch's idiomatic files are all `loc_<addr>` —
  `ls games/dkong/idiomatic/*.js | xargs -n1 basename | grep -E '^(sub_|handler_|entry_|draw_[0-9]|branch_|tail_|guard_)'`
  must be EMPTY (earned English promotions like buildBoard/drawHighScore are exempt — those went
  through R4). Also FAIL a redundant re-decompile: if a batch adds `loc_<addr>.js` for an address
  that already has a committed idiomatic file (any name), the duplicate must be reconciled, not committed.

## Every routine gated with teeth
- **R12 [D]** Each new/changed routine has an equivalence test that (a) compares work-RAM to the
  frozen oracle, (b) asserts the routine's REAL live-out (return value too, not just RAM), and
  (c) has ≥1 broken-twin "teeth" case the test actually CATCHES. Verify: read the test; teeth
  assertions present and non-vacuous; run it if unsure.
- **R17 [ALL]** A `GATE:` / `NAMES:` header, and a test file's own header, must describe what the
  gate ACTUALLY exercises — and a coverage claim that is VACUOUS must say so explicitly, in the
  header, rather than reading as coverage. "Replays every captured dispatch" when zero dispatches
  were captured, "all N routines live" in a file that wires one, "runs the whole game" in a tool
  that cannot construct that game's Machine: each is a claim the reader will bank and none of them
  is true. Stating the hole ("this covers attract only; gameplay is not covered", "no dispatch was
  captured for this arm, so the real-capture case is vacuous here") is compliant — silently
  overstating is not. This is the rule that catches the gate nobody has ever seen fail.
  Verify, mechanically, for every gate/test the diff touches or relies on:
  1. RUN it, and check the header's claim against what ran — `node --test <file>` prints each test
     name; a header claiming a scenario with no corresponding assertion FAILS.
  2. For each COUNT or SET the header names ("all 379", "every captured dispatch", "0x8000-0x87FF"),
     find the line that produces it and confirm the number matches — `grep` the wiring call
     (`resolveAllIdiomatic` vs `resolveOverrides({...})`), the fixture array's length, the literal
     range. A header number with no producing line FAILS.
  3. Confirm the gate has been OBSERVED FAILING for the thing it claims to catch: either the diff
     shows a teeth case, or the author reports the exact failure message from breaking it.
  4. For a shared cross-game tool, run it for EVERY game it names, not just the one you changed —
     a tool that exits non-zero on argument parsing or a missing method has never run there.
  *Why: five live instances found in one session — `games/dkong/idiomatic/test/golive.test.js`'s
  header described a config it does not wire, `loc_2a22`'s `GATE:` header claimed attract captures
  that do not exist, `loc_281d` carried a stale dependency note, `tools/swap_check.mjs` died on
  `Machine.create is not a function` for DK so its "only running the whole game catches that" had
  never once run there, and `tools/names_consistency.py` inspected The Pit's 0x8000-0x87FF window
  on every DK commit and so matched nothing. All five were green; none was checking anything.*

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

*R10's recipe was completed at the same time (2026-08-02): it had checked only the `m.call(0x…)`
form and was blind to the direct `../translated/loc_XXXX.js` import form, which had accumulated 26
stale references across exactly 16 DK idiomatic files (25 files import a translated loc at all; 16 of those have a stale one). Same species as R17 — a check that reads as
complete, run for years, that could only ever have caught half of what its own statement forbids.*

*R17 was added after a whole-game guest-stack leak survived 368 green per-routine gates plus the
go-live gate: every gate that could have seen it was either scoped away from the seam or, in two
cases, structurally incapable of running at all (`swap_check.mjs` for DK, `names_consistency.py`'s
address window). The fix is deliberately NOT another gate script — a script cannot tell whether a
header's claim is true. It is a rule, whose verification recipe ends in "has this gate ever been
observed failing?", because that is the question none of the five instances could have answered.*

*R18 was added after a reachability sweep refuted the premise the lead had been reporting for
several passes. With 105 DK routines unnamed, the standing account was that they were blocked for
want of grounding. One 150-second MAME run with a read tap per entry showed 84 of them executing —
one of them 9,548 times. The technique was NOT documented anywhere until the preceding commit put
it in grounding.md; an earlier draft of this note claimed it "was already documented and simply was
not being reached for", which was false and erased that commit's contribution. The honest account
is two steps: write the technique down, then REQUIRE reaching for it, because a document alone
supplies no requirement. It is a rule and not a gate for the narrower reason that no script can
check whether a pass formed its belief by measuring or by guessing — a reviewer reading the pass's
own report can. (The mechanical half, check 1 and the existence half of check 2, IS scriptable;
gating only that would recreate the proxy failure this file's own history documents.) Prompted by
qarl asking whether the method was written down where the next game would find it.*
