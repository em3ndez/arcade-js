# Reviewer rules — process-compliance checklist

Hand this to EVERY commit's review agent, in addition to its correctness review. The reviewer
already checks correctness; these are the PROCESS rules that drift when only the lead watches
them. Check each against the STAGED diff (`git diff --cached`), `git log`, and the repo. Any
violation → WITHHOLD the review token and report `Rxx` + the exact file/line/evidence. Each rule
names how to verify it so the check is mechanical, not a matter of opinion.

Enforcement lives HERE — in the rules an independent review agent checks — not in bespoke gate
scripts. A gate can only test a proxy; the review agent can judge the actual requirement. (The
always-on git hooks are `review_gate` / `names_consistency` / `understanding_gate` /
`idiomatic_comments`; do not add more — express a new requirement as a rule below. The last of those
is the one exception and R21's History note argues it: its test is REFERENCE, not truth, so it is
not a proxy for the requirement — it IS the requirement.)

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
  - **R3a — a NUMBER is `[seen]` only if its evidence chain TERMINATES in a MAME observation.**
    Our engine may be IN the chain: a pixel diff runs our renderer against a MAME golden and stays
    `[seen]`, because the reference side is the real machine. What is forbidden is a chain that
    terminates in our OWN output — a `Machine`/`runFrames` dispatch count, an override-map replay,
    or an idiomatic-vs-oracle equality (`golive.test.js` compares our JS against our JS). Those are
    sound facts about the PORT, and they are `[code]`.
    Verify: for every `[seen]` whose evidence is a number, follow the chain to its far end and ask
    what produced the REFERENCE. Do not classify by which tool ran — `prize_suite.py` emits both
    kinds from one script (its pixel diff is against a MAME golden and is `[seen]`; its pickup
    assertion is read out of our own state dump and is `[code]`).
    **Burden of proof: a `[seen]` number whose MAME artifact you cannot open right now is `[code]`.**
    That is the same posture as R18 check 2, and it is what makes the check workable at review time
    given the evidence is ephemeral by design.

- **R18 [U]** An understanding/naming pass must state HOW MANY routines remain unnamed
  and WHY — and "why" must rest on a REACHABILITY MEASUREMENT, not on an impression. Before a pass
  reports any routine as blocked, held, or hard, the backlog must have been swept: a read tap at
  each unnamed entry address on the real ROM under MAME, driven across boards/levels/difficulty,
  with hit counts attributed to the live game state (see grounding.md, "Triage the backlog FIRST").
  The pass must name at least one blocked cluster its run actually attacked.
  Verify:
  1. The pass reports an unnamed COUNT, and it matches the registry — re-derive it.
  2. A reachability sweep exists for this pass, with its script and run parameters cited, and YOU
     OPEN IT. A session scratchpad is a fine home for it — the evidence does not have to outlive
     this review, and the committed prose should carry the FINDING, not a path. An assertion that
     routines are "not reachable" or "nothing grounds them", with no sweep you could open, FAILS.
     This is the whole point of the rule.
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
- **R5 [ALL]** Every name promoted loc_<addr>→English **in the commit under review** is corroborated
  by evidence OUTSIDE the routine itself (a named cell it touches, an idiomatic caller/callee,
  mechanisms.md, or a sibling), and **that routine's `ROUTINES` entry in `names.js` states the
  corroboration in its `why` field** (defined in names-registry.md, "Routines — the `ROUTINES` map").
  Scoped to this commit's promotions, exactly like R4: entries promoted before the field existed do
  not have one, and a missing `why` on an untouched entry is NOT a violation. Do not fail a commit
  for the backlog, and do not backfill it by re-deriving old evidence from memory.

  It is the registry entry and NOT the file header because R21 forbids an idiomatic header from
  naming a caller, a sibling, `mechanisms.md` or the oracle — which is every form of corroboration
  this rule requires. The registry is exempt precisely because cross-file facts are its job, so
  that is where a name's evidence belongs; it also puts the name and its justification in one
  place instead of two. A header may still state what the routine does and why its own body reads
  that way — it just cannot be where the outside evidence is cited.

  Verify: read the renamed routine's registry entry — then locate what CHECKED the
  prediction and confirm the entry cites it somewhere YOU can open right now: a write-set/RAM
  diff, a `reach_sweep` row, a per-cell verdict in this pass's grounding report, or a derivation
  from a DIFFERENT body of code (the caller, a sibling, mechanisms.md) that COULD HAVE COME OUT THE
  OTHER WAY. The test is falsifiability, not instrumentation — reading the caller and finding it
  uses the result as a table index would refute "this classifies", so that derivation counts, while
  a restatement of the routine's own body does not. "Read the entry" alone cannot catch this: an
  entry restating the routine's own code-reading passes it. A corroboration clause with nothing
  behind it that you can open FAILS. **The evidence itself may be ephemeral — a session scratchpad
  is a fine home for it, and we do not commit everything.** You are the one who checks it exists and
  says what it says; a later reader re-derives from the ROM, not from our session. Do not require
  the artifact to outlive the review, and do not make anything carry a path to it.

  **The corroboration must be a PREDICTION the name makes, that was then checked** — not a
  restatement of the same code-reading in other words. Ask of each promotion: what would be
  observably different if this name were wrong, and did anyone look? "String renderer" predicts
  writes to VRAM `0x7400+`; the routine writes 4-byte sprite records into `SPRITE_BUFFER` at 0x6900
  and never touches 0x7400+ at all, so one write-set diff would have killed the name before it
  spread through the cluster and its gates. A header whose corroboration cannot fail is not
  corroboration. Cheapest checks, all theory-free: the routine's write-set, its reachability and the
  states it fires in, and what its caller does with the result.

  Corollary — **the header may claim only what its writer derived.** Prose beyond the name's
  justification and the cells read/written is unverifiable in bulk and propagates by imitation into
  sibling files. The budget is the fixed header template (role, what the routine does, `LIVE-OUT:`)
  PLUS the name's derivation — it never licenses trimming those. The ROM tag and the
  `Memory-equivalent`/`GATE:`/`NAMES:` blocks are NOT part of an idiomatic header since R21; they
  name things outside the file and now live in the registry, the test header (where R17 governs
  them) and the import list. Where the evidence stops, the header must say so rather than round
  up to a confident reading; a named open question is a PASS, a plausible guess stated as fact is a
  FAIL. See `decompiler-pipeline.md`, "A claim budget per header".
- **R6 [ALL]** Where purpose is not corroborated, the routine STAYS loc_<addr>. A confidently-wrong
  English name is a violation. Verify: spot-check promoted names aren't guesses.

## Single source of truth (names.js)
- **R7 [ALL]** No staged prose (routine comment or mechanisms.md) calls a cell that IS named in names.js
  "unnamed / kept hex / no names.js name". Verify: `python3 tools/names_consistency.py check` (also a
  hook) + scan comments in the diff.
- **R8 [ALL]** A cell named in names.js is IMPORTED from names.js, not redefined as a local hex const.
  Verify: grep the diff for `const [A-Z_0-9]+ = 0x6[0-9a-f]{3}` duplicating a names.js name.
- **R16 [ALL]** Every named cell in names.js carries a grounding rating. Verify by PARSING names.js: for
  each `export const NAME = 0x…`, its own comment must contain `[seen]`, `[code]`, or `[guess]`.
  **FAIL if ANY named cell is unrated** — no ratchet, no legacy-debt exception. A name is not
  understanding; the registry is complete only when every cell is labeled.

## Translation conventions
- **R9 [ALL]** No import from `optimized/` (retired layer). Imports resolve from `./names.js` and other
  idiomatic files. Verify: `git diff --cached | grep optimized/`.
- **R10 [ALL]** No idiomatic routine calls an already-idiomatic callee via `m.call(0xADDR…)`/push16
  (stale oracle leak) — idiomatic callees are direct JS calls.
  THE DEFECT HAS TWO FORMS AND THE RECIPE MUST CHECK BOTH. The registry form is the obvious one; the
  other is a direct ES import of the frozen oracle — `import { loc_30bd } from "../translated/loc_30bd.js";
  // no idiomatic yet` — in a file where the idiomatic twin DOES exist and that address IS in
  ROUTINES. Same leak, and the comment beside it is false as well.
  Verify (both, per game touched):
  1. `git diff --cached | grep 'm\.call(0x'` — any hit whose target address is a key of that game's
     `games/<game>/idiomatic/names.js` ROUTINES map FAILS.
  2. Resolve every `from "../translated/loc_XXXX.js"` import in the staged idiomatic files against
     the same ROUTINES map; any whose address is present FAILS. Game-agnostic one-liner:
     ```sh
     GAME=<game> node --input-type=module -e '
     import { readdirSync, readFileSync } from "node:fs";
     const d = `games/${process.env.GAME}/idiomatic`;
     const { ROUTINES } = await import(`./${d}/names.js`);
     for (const f of readdirSync(d).filter((x) => x.endsWith(".js")))
       for (const m of readFileSync(`${d}/${f}`, "utf8").matchAll(/from "\.\.\/translated\/loc_([0-9a-f]{4})\.js"/g))
         if (ROUTINES[parseInt(m[1], 16)])
           console.log(`${f}: imports translated/loc_${m[1]}.js but ${ROUTINES[parseInt(m[1], 16)].name} is idiomatic`);'
     ```
     It scans the whole tree, so judge only the files THIS commit stages; pre-existing hits are a
     separate cleanup unit. Run it to see whether any stand — do not carry a count from this doc.
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
- **R17 [ALL]** A `GATE:` header, and a test file's own header, must describe what the
  gate ACTUALLY exercises — and a coverage claim that is VACUOUS must say so explicitly, in the
  header, rather than reading as coverage. (Since R21 a `GATE:` block lives only in a test file's
  header — an idiomatic routine header may not cite a test at all — and `NAMES:` is gone entirely,
  since the import list already states which `names.js` cells a routine uses. R17 is unchanged in
  substance; only the files it applies to moved.) "Replays every captured dispatch" when zero dispatches
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
  on every DK commit and so matched nothing. All five were green; none was checking anything.
  (Those five are the HISTORICAL examples that produced this rule; all five were verified fixed in
  2026-08. In particular names_consistency.py has derived its window per game from the board memory
  map since a94ede3, and is live for DK's 0x6000-0x6BFF — do not cite THE WINDOW as a current blind
  spot. Its docstring records the holes that DO remain, chiefly that a trailing comment escapes
  scanning entirely. A reviewer cited the window from this footnote in 2026-08 and had to retract
  after teeth-testing the tool; a second reviewer then caught this note citing the wrong commit for
  the fix — ce6f6ea is a later, separate repair to the same tool, its uppercase-hex EXPORT regex.)*

## A commit's account of itself

- **R19 [ALL]** Every statement a commit makes ABOUT ITS OWN DIFF must be verified against the diff,
  not against the author's account of it. This is the defect that has most often cost a review
  round recently — and because it is caught BEFORE commit, the committed history cannot show it, so
  do not expect to find it there. On one 2-file comment-only commit (c880a82) it caused five
  consecutive review failures — reported by the author, not recorded in `.reviews/` — while not one
  of that commit's ROM findings ever moved.

  The three forms it takes, each with the check that catches it:
  1. **A number about the diff.** Counts of files, sites, roles, occurrences. DERIVE IT FROM THE
     DIFF at the moment of writing — `git diff --cached --name-only | wc -l`,
     `git diff --cached | grep -c ...`. A count carried from an earlier draft is stale the moment
     the diff changes, and it always changes. (Observed in review drafts. None of these mistaken
     statements was ever committed as an assertion — they survive only as the examples quoted here:
     a draft claiming five role strings after a sixth was added, landing as 42c1f07's "six role
     strings"; a draft claiming "both sites" where the file had three, landing as c880a82's "all
     four sites".)
  2. **A quotation.** Quoting text is a claim that those exact words exist in that exact file.
     GREP EACH QUOTE against the parent revision before writing it — `git show HEAD:<path> |
     grep -F "<quote>"` — and check the PROVENANCE: words
     the author wrote in an earlier *staged draft* are not in the parent and never will be.
     (Observed: two fabricated quotes; one real quote attributed to the header when it had only ever
     existed in a draft.)
  3. **A claim that a fix landed.** GREP THE STAGED BLOB FOR THE OLD WORDING before reporting a fix
     done — `git show :path | grep -F "<old text>"` must return nothing. Editing the commit message
     and believing the file changed is a real and repeated failure. (Observed: a reviewer found the
     staged blob byte-identical to the previous round after the author reported the edit made.)

  Two corollaries, both earned the same way:
  * **A fix applied where a reviewer points leaves its siblings alive.** When told about an instance,
    sweep for the CLASS. (Observed twice in one commit: three "edge reset" sites where two were
    claimed; a fabricated quote corrected in one place and left standing in another.)
  * **Re-read the WHOLE file each round, not the delta.** A fix can convert a merely-stale
    neighbouring clause into a live contradiction. (Observed: deleting a disclaimer, then asserting
    its opposite, refuted a clause three lines up that had been tolerable before.) Verify: read the
    whole touched file AT THE STAGED REVISION, not the diff hunks, and confirm every clause
    adjacent to a change is still true.

  Verify: for each such statement in the message and in any touched header, run the producing
  command. A statement about the diff with no producing command is unverified, and unverified
  statements about the diff have been wrong more often than right here.

## What a file is allowed to say about the past

- **R20 [ALL]** A source file states what is TRUE NOW. It does not narrate the drafting that got it
  there. Out of any committed comment, header, doc or commit message: "an earlier version of this
  header said X", "that citation is withdrawn", "the reason this file previously gave", "★ CORRECTION",
  and every "three candidates, not two" construction that only parses against text the same diff
  deletes. The diff records what changed; the file records the code.

  Two reasons, and the second is the sharp one:
  1. The reader has the file, not the session. Prose that only makes sense beside its own predecessor
     is unreadable the moment the predecessor is gone — which is immediately, since the same commit
     removes it.
  2. **Most of what these notes cite was never committed.** Measured on one 19-file unit: 10 such
     passages, all of them pointing at wording that had existed only in the author's working tree,
     that same session, for about an hour. There is no revision a reader can check them against.
     Worse, two entries in the same unit's commit message announced the WITHDRAWAL of absolutes
     that appear nowhere in the repository at any revision — retractions of the author's own
     private drafts, presented as repairs to the codebase.

  What survives the rule: a warning against a reading a future reader could plausibly re-derive
  ("NOT A STRING RENDERER — the tables at 0x39C3 are (x,y) waypoint pairs") is a statement about the
  code, and stays. So does a PROVENANCE note separating what was measured from what was inferred.
  What goes is the before/after framing wrapped around them.

  The same rule governs the commit message: it says what the commit DOES. "Corrects X to Y" IS the
  change and belongs; the history of the author's drafts does not.

  Verify: `git diff --cached -- . ':(exclude)docs/reviewer-rules.md' | grep -Ein '^\+.*(earlier (draft|version|header)|previously (said|gave)|used to say|the old text|is withdrawn|has been removed|★ CORRECTION)'`
  returns nothing. (The exclusion is not a loophole — it keeps this rule's own quoted EXAMPLES
  from matching it.) A hit FAILS unless the cited past wording is quotable from the parent revision
  (`git show HEAD:<path> | grep -F`) AND a reader of the current code would otherwise re-introduce
  the error. Both conditions, not either.

## What a file is allowed to say about other files

- **R21 [ALL]** A comment in `games/<game>/idiomatic/` describes THAT FILE and nothing else. No ROM,
  no MAME, no frozen oracle, no sibling module, no test, no doc, no to-do. A count of what is in the
  file is fine; a count of anything outside it is not. Exempt, because their job *is* the cross-file
  map: `translated/**` (it comes from the disassembly — the address is its identity),
  `idiomatic/names.js` (the registry), and `idiomatic/**/test/**` (a test must name its subject).

  The mechanical half is a gate — `tools/idiomatic_comments.py check`, wired into `hooks/pre-commit`
  — because unlike every other rule here it tests REFERENCE rather than truth, and that is
  decidable by a script. **What the reviewer adds is the part a script cannot do: whether the
  displaced content landed somewhere, or was simply deleted.** A header stripped of its
  `Memory-equivalent to …` line without the equivalent claim appearing in the test file's own
  header, or a grounding finding removed without reaching `mechanisms.md`, passes the gate and
  fails this rule. Deleting the evidence is not complying with the rule; relocating it is.

  Verify: `python3 tools/idiomatic_comments.py check` exits 0 (the hook runs it, so a landed commit
  has already passed it — the reviewer's job is the second paragraph). For a commit that strips
  headers, diff what left against what arrived: `git diff --cached -- '*/idiomatic/*.js'` (note this
  pathspec also matches the exempt `idiomatic/test/**`, which you want anyway — that is where the
  gate claims land) and confirm each surviving CLAIM is present in the test header, the registry, or
  `mechanisms.md`. A removal with no destination FAILS unless the claim was false or vacuous, which
  the commit message must then say.


## Staging & commit hygiene
- **R13 [ALL]** The staged diff contains ONLY files of this commit's stated unit — a DECOMPILE stages
  that batch's routines+tests; an UNDERSTANDING stages renames/names.js/mechanisms/retrofits. No
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
stale references across 16 DK idiomatic files that day. Same species as R17 — a check that reads as
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

*R19 was added after a two-file, comment-only commit (c880a82) failed review five times running
without a single one of its ROM findings moving. Every failure was the commit's account of itself:
a cited hunk that was unstaged, a count left behind by the author's own edit, two fabricated
quotations, a real quotation attributed to the parent when it had only ever existed in a draft, and
finally a fix reported as landed that had been made only to the commit message. Two of the five were
introduced by the fix for the previous one. The existing rules govern evidence for claims about the
GAME, and R17 already governs what a gate's HEADER claims about itself — its check 2 is this rule's
form 1 applied to headers. What had no rule was the commit MESSAGE, which is where those rounds
were actually spent.
Note the asymmetry this rule lives with: the defect is caught pre-commit, so `.reviews/` and the log
record the corrected version and never the mistake — the evidence for R19 is review transcripts, not
history.*

*R21 is deliberately a GATE, against this file's own closing instruction to add requirements as
rules and not gates. That instruction's reason is that a gate tests a PROXY; R21's mechanical half
tests none — the forbidden thing IS the reference, and "does this comment name something outside
this file" is what a regex decides. The half that would be a proxy, whether the displaced claim
landed anywhere, is left as the rule in R21's second paragraph. The seam is truth vs reference.

It was added after step 8 of the understanding formula was run twice on Donkey Kong and done by
token substitution both times — the second time after a reviewer had written down, in the defect
list the fixer was working from, that a token sweep cannot work. It cannot, because only claims
naming a RENAMED THING are findable that way, and most stale cross-file claims never name it. The
root cause was not the sweep: `idiomatic/`'s comment rule existed only in the lead's memory and had
never been written into `docs/`, so every agent that generated the layer worked without it — which
is why the whole layer violated it uniformly rather than by drift. A procedure changed in someone's
head is not a procedure.

Three things its own review established, each a defect a reader of the code would not have
predicted. A comment scanner cannot find comments by blanking string literals first: comments are
English, English has apostrophes, and one opens a string that swallows the following lines. A
`loc_<addr>` must be caught as a sibling citation but exempted when a file names ITSELF, or the
gate refuses the exact header R11 mandates for every unnamed routine. And the tool counts nothing
on purpose: a count of the tree is a derived fact, true once and false after the next file is
cleaned, so `scan` prints one line per violation and the exit code carries zero-or-not — with a
root that matches no in-scope file an ERROR rather than a pass, since a green scan is what licenses
skipping the tree-wide half of step 8.

Prompted by qarl, who asked what step 8 actually was and then observed that the fix was to stop
putting the material in the files at all.*
