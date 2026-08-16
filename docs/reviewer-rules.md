# Reviewer rules — process-compliance checklist

Hand this to EVERY commit's review agent, in addition to its correctness review. The reviewer
already checks correctness; these are the PROCESS rules that drift when only the lead watches
them. Check each against the STAGED diff (`git diff --cached`), `git log`, and the repo. Any
violation → WITHHOLD the review token and report `Rxx` + the exact file/line/evidence. Each rule
names how to verify it so the check is mechanical, not a matter of opinion.

Enforcement lives HERE — in the rules an independent review agent checks — not in bespoke gate
scripts. A gate can only test a proxy; the review agent can judge the actual requirement. (The
always-on git hooks are `review_gate` / `names_consistency` / `understanding_gate` /
`comment_gate`; do not add more — express a new requirement as a rule below. The last of those
is the one exception, and it carries TWO rules that are exceptions for the same reason: its
REFERENCE test is not a proxy for R21, it IS R21; and its DENSITY test counts lines, which is
the whole of the rule rather than a stand-in for it. Neither asks whether a comment is true —
that stays here, with you.)

First, classify this commit from its subject line:
  DECOMPILE  = "decompile batch N"      UNDERSTANDING = "understanding pass N"
  INFRA/DOC/FIX = anything else
Rules tagged [D]/[U]/[ALL] apply to that class.

## Cadence — the drift this list exists to stop
- **R1 [D]** No two DECOMPILE commits without an UNDERSTANDING commit between them.
  Verify: read `git log --format=%s` from newest; walking back from HEAD, an "understanding pass"
  commit must appear before you reach a second "decompile batch" (i.e. this decompile batch is not
  the second in a row with no understanding pass between them).

  ★ **OPEN QUESTION FOR KARL — do not resolve this by reinterpretation.** The headline above says
  "decompile COMMITS"; the verify recipe says "decompile BATCH". Those named the same object until
  now, because `idiomatic-generation.md` defines a batch as the content of ONE commit — *"the
  unit of work is a batch of about ten routines"*, *"land the batch as a DECOMPILE commit"* — and
  the history bears that out — every commit titled `decompile batch <N>` carries a group of
  routines. **The instruction to commit one routine at a time is what splits them**: ten
  single-routine commits are ten decompile COMMITS and one decompile BATCH.

  Until Karl rules, **the headline governs** — a reviewer withheld a token on exactly this and was
  upheld, on the ground that the permissive reading requires "batch" to mean a group of commits,
  which appears nowhere in `docs/`. Whichever way he rules must be written into **both** this rule
  (headline *and* recipe) **and** `idiomatic-generation.md` step 6; one place is not enough, since
  keeping them in step in only one place is how they drifted apart.

  *Worth recording because it cost a round: two agents argued this from the text in front of them
  and each found the half that agreed with them. Neither opened the document that defines the term.
  When two readings of a rule disagree, the disagreement is usually not in the rule — it is in a
  word the rule leaves to another document.*

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
  with hit counts attributed to the live game state (see idiomatic-generation.md, "Triage the backlog FIRST").
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
  PROPOSER file AND a separate CONFIRMER file, written by distinct agents. **Verify by ADDRESS, not
  by name**: grep both files for `0x<addr>`. The confirmer is expected to rename — a promotion whose
  final name is absent from the proposals file is the NORMAL case and not a finding. What the rule
  requires is that the same ADDRESS was proposed by one agent and confirmed by another.

  ★ **Find the two files by asking the pass, not by pattern.** The naming has already changed once —
  `pass<N>-confirmed.md` gave way to `pass-c<N>-entries.md` / `pass-c<N>.md`, alongside proposer
  files named `proposals-cluster<N>.md`, `routines-cluster<N>.md` and `authored-cluster<N>.md`. A
  recipe that hard-codes either filename goes silently unrunnable the next time a pass renames its
  own output, which is exactly the failure this rule already had once.

  *Why the join key changed: it used to join the two documents on the promoted NAME. But a confirmer
  doing its job changes names, and in the recent cluster passes nearly every promotion was renamed
  away from the proposer's wording, precisely because the confirmer refused it. Grepping for the
  final name then finds nothing, and the rule reads as violated exactly when the process worked. A
  recipe that fails on correct behaviour and passes on rubber-stamping is inverted.*

- **R4b [ALL]** A cell that is `[code]` **or** `[seen]` must be exported by a DESCRIPTIVE identifier,
  not `loc_<addr>` — a cell earns its name at the `[guess]`→`[code]` transition, not at grounding
  (runbook: "A cell earns its DESCRIPTIVE identifier the moment it reaches `[code]`"; the only sanctioned
  forms are a descriptive `export const` or keep-hex, never `export const loc_<addr>`). **Verify:** for
  each cell the commit adds/touches whose tag is `[code]` or `[seen]`, grep its `names.js` line — if the
  `export const` is still `loc_<addr>`, the naming is half-done and the unit is not finished. The rename
  is value-identical (address unchanged) and must update every importer, so also confirm
  `git grep "loc_<addr>" games/<game>/idiomatic` returns nothing for a now-renamed cell (a stale import
  would fail to load). Fire on `[code]` and `[seen]`; a `[guess]`/unknown cell correctly stays keep-hex
  (a bare literal, no const) — do not force a name before the reading is confident. (Recorded
  2026-08-15: the frogger pipeline left most of its confident cells — `[code]` and `[seen]` — named
  `loc_<addr>` until Karl caught it: "when a cell changes guess→code, that's when it should be renamed.")
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
  FAIL. See `idiomatic-generation.md`, "A claim budget per header".
- **R6 [ALL]** Where purpose is not corroborated, the routine STAYS loc_<addr>. A confidently-wrong
  English name is a violation. Verify: spot-check promoted names aren't guesses.

## Single source of truth (names.js)
- **R7 [ALL]** No staged prose (routine comment or mechanisms.md) calls a cell that IS named in names.js
  "unnamed / kept hex / no names.js name". Verify: `python3 tools/names_consistency.py check` (also a
  hook) + scan comments in the diff.
- **R8 [ALL]** A cell named in names.js is IMPORTED from names.js, not redefined as a local hex const.
  Verify WITHOUT a hardcoded address range: read the game's `names.js`, collect the addresses it
  names, and grep the diff for any `const [A-Z_0-9]+ = 0x…` whose value is one of them. ★ The recipe
  here used to say `0x6[0-9a-f]{3}`, which is **Donkey Kong's** work RAM — so a reviewer following
  it literally on any other game grepped a range that cannot appear and reported clean having
  inspected nothing. `tools/names_consistency.py` documents that exact defect in its own docstring
  and already fixed it by deriving each game's window from `boards/<board>/memory.js` through the
  manifest; the hardcode survived only here, in the half a person follows. A check that cannot fail
  is not a check.

  Two things this rule does NOT cover, so do not read a pass as more than it is. **Naming a cell is
  retroactive**: the moment a cell enters `names.js`, every surviving local alias for it becomes a
  violation, in files the naming commit never touched — so a rewire must sweep the whole layer at
  the moment of the edit, not from an earlier count. And a bare hex CITATION in prose is not a
  redefinition: R7 forbids calling a *named* cell unnamed, but mentioning an address makes no such
  claim, so naming that cell later creates staleness rather than a violation.
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

## Wiring — a module nothing dispatches is not in the layer
- **R22 [ALL]** Every idiomatic module added by this commit appears in `ROUTINES` under its own
  name, or in `tools/registry-coverage.config.mjs` — `UNWIRED` with a reason, or `DEBT`. And every
  `ROUTINES` entry this commit adds has its module in the same commit.
  Verify: `node --test tools/test/registry-coverage.test.js`, and read the reason for any exemption
  this commit adds — an exemption whose reason you cannot check is a failure. The test reads the
  INDEX, so it already describes the staged diff you are reviewing: an untracked module in the
  author's tree is not yet a claim, a staged one is.

  WHY THE REVIEWER AND NOT ONLY THE TEST. The dispatch map is built by walking `ROUTINES`, so a
  module no entry names is never dispatched: its address is not overridden, so every dispatch to it
  runs the frozen oracle, and the rewrite is reached only by a sibling importing it directly — for
  many, by nothing but their own gate. Nothing turns red, because a gate imports its module rather
  than dispatching to it. The test catches the absence; it cannot judge whether an `UNWIRED` reason
  is TRUE, and a false reason is how a bulk exemption gets a test back to green. Re-derive each new
  one from the code — the argument really does arrive on the stack, the loop really has no exit, no
  table really names that address — exactly as R5 asks of a `why`.

  ★ COVERAGE IS NOT EXECUTION. A green run says every module is dispatchABLE. It does not say the
  layer runs: `manifest.runtime` decides that, and a game set to `"translated"` never calls
  `resolveAllIdiomatic`. Do not accept this test as evidence that a layer is live — READ THE
  RUNTIME it prints on each game's verdict line, and if a commit wires modules into a layer the
  manifest does not run, say so in your report. That is not a violation of this rule; it is the
  thing this rule cannot see.

  On the file's closing instruction to add rules and not gates: the rule alone was already tried
  here. `idiomatic-generation.md` has required the registry entry all along, in two places, naming
  Donkey Kong as the precedent, and the batch it names is still unwired. What was missing was not a
  statement but a consequence, and the mechanical half tests no proxy — the forbidden thing IS the
  missing entry, which a script decides exactly. The half that would be a proxy, whether an
  exemption's reason is true, stays above with you.

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

  Verify: `git diff --cached -- . ':(exclude)docs/reviewer-rules.md' | grep -Ein '^\+.*(earlier (draft|version|header|revision|round|wording)|previously (said|gave)|used to say|the old text|is withdrawn|has been removed|★ CORRECTION)'`
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

  The mechanical half is a gate — `tools/comment_gate.py check`, wired into `hooks/pre-commit`
  — because unlike every other rule here it tests REFERENCE rather than truth, and that is
  decidable by a script. **What the reviewer adds is the part a script cannot do: whether the
  displaced content landed somewhere, or was simply deleted.** A header stripped of its
  `Memory-equivalent to …` line without the equivalent claim appearing in the test file's own
  header, or a grounding finding removed without reaching `mechanisms.md`, passes the gate and
  fails this rule. Deleting the evidence is not complying with the rule; relocating it is.

  Verify: `python3 tools/comment_gate.py check` exits 0 (the hook runs it, so a landed commit
  has already passed it — the reviewer's job is the second paragraph). Note it carries the DENSITY
  rule too and reports both, so a nonzero exit is not necessarily about R21; read which rule the
  message names. A "cannot lex" block is neither — it means the file could not be judged. For a commit that strips
  headers, diff what left against what arrived: `git diff --cached -- '*/idiomatic/*.js'` (note this
  pathspec also matches the exempt `idiomatic/test/**`, which you want anyway — that is where the
  gate claims land) and confirm each surviving CLAIM is present in the test header, the registry, or
  `mechanisms.md`. A removal with no destination FAILS unless the claim was false or vacuous, which
  the commit message must then say.

- **R23 [ALL]** A probe or script that reproduces a gate's subject must reuse that gate's **wiring
  path** and its **exclusion window**, or state in the file why it diverges from both. Hand-rolled
  apparatus omits what the real apparatus encodes.

  Verify: the probe resolves overrides the way the shipped code does (for arcade-js,
  `resolveOverrides`, so candidates cross the same seam as every registered entry), runs **the
  engine the GATE runs** — for the assembled-swap gate that is `runCycleFree`, which is a test seam
  and NOT what the player runs — and masks `manifest.convergence.stateExclude`. Read the gate and
  see; do not assume the gate and the player share an engine, because here they do not.

  ★ The strongest single control, and it costs one run: **wire the candidate to the FROZEN ORACLE
  and require byte-identity with baseline.** It catches wrong-engine, wrong-exclusion and
  wrong-wiring at once. A no-op control (re-apply something already in place, require nothing to
  change) is real but weaker — it is inert under any comparison window, so it cannot see a
  wrong-exclusion fault. **A control licenses exactly the inference it tests and nothing adjacent.**

  And the cheap sanity check that ends most of these in a minute: **run the probe against the code
  already shipped.** An instrument that condemns the live registry is not detecting a defect.

  *Why: three probes in one night each returned a confident, plausible, wrong answer — one reported
  a defect class that does not exist, one condemned routines a colleague had cleared. Both omissions
  were sitting in committed files the whole time.*

- **R24 [ALL]** A comment-density pass is a fact about the file AS IT WAS. The cap scales with code
  length, so **DELETING code can push an unchanged header over the cap** — a rewire that removes
  local `const` declarations, a refactor that shortens a body.

  Verify: re-run `comment_gate.py check` after any edit that REMOVES lines, not only after edits
  that add prose. **Cut the prose; never raise the cap.**

  *Why: this blocked two commits in one night, both times because a retroactive R8 rewire deleted
  `const` lines from a file whose header a confirmer had already sized against the old body. Nothing
  about the header changed; something else did.*

- **R25 [ALL]** Deleting a declaration ORPHANS the doc block above it, and **JSDoc attaches
  DOWNWARD** — so an orphan does not merely go stale, a reader binds it to the NEXT declaration,
  which is a different thing. That is a false statement in the file, not a tired one.

  Verify: after any rewire or deletion, check every `/** … */` immediately followed by a blank line
  for whether the next non-blank line is still a declaration. Delete the orphan; do not reword it —
  the claim it made belongs in the registry entry for the cell that now has a name. Run the check
  with a PLANTED orphan in the same pass, so a clean result is a measurement.

  *Why: a rewire deleted `const SCORING_PLAYER_TWO = 0xad32;` from a gate and left
  "Which player's score the award routine was working on…" standing above a different cell's
  declaration. ★ The general shape: **a script that removes lines must own everything ATTACHED to
  those lines**, and finding one instance means sweeping every file that script has ever touched.*


- **R26 [ALL]** A test that needs a ROM must SKIP without one, and this is checked by RUNNING, not
  by reading. `README.md`'s Quickstart tells a stranger to run `npm test` and promises the
  ROM-dependent tests "skip cleanly if you haven't built one". Nobody outside the project owns the
  ROMs, so that is the only path an outside reader ever takes.

  Verify: `node tools/rom_guard_check.mjs`. It clones the committed state — ROM images are
  gitignored, so the clone has none BY CONSTRUCTION — and runs the project's own test command
  there. Anything that FAILS is the defect; skipping is the intended outcome and passing is fine.
  The pre-push hook runs it, so a landed commit has already passed it.

  ★ **It reports on the COMMITTED state, so at review time it cannot see the diff under review.**
  On a commit that REPAIRS a guard it returns FAIL, because it is still reading the parent. A
  reviewer who runs it literally will block a correct commit, or learn to ignore it. To judge a
  staged repair, commit it in a scratch clone (or `git stash` nothing and run it after committing
  locally, before pushing) — the push hook is the enforcing use; the review-time use is diagnostic.

  ★ **Do not replace this with a grep.** Two guard idioms are live: `romsPresent()` plus `{ skip }`,
  and *shadowing* `test` with a ROM-conditional wrapper — whose calls read `test(name, fn)` and look
  unguarded while being guarded. Both dkong and thepit use the shadow, and so does timeplt's own
  `assembled-swap.test.js`, so this is not one game's local habit. A grep for `romsPresent` condemns
  every healthy dkong test file, and an idiom invented later would break a static check silently.

  *Why it is owed: nine gates broke the promise, four of them already pushed to the public branch.
  A static repair keyed on `^test(` then reported itself complete while missing tests generated
  inside a `for` loop, and a ROM read reached from inside a test body. Both were found by running,
  after the pattern said it was done.*

- **R27 [ALL]** **Before you measure, read what the tree already says. After you measure, do not
  let the sentence outrun the log.**

  Verify: before building apparatus, grep `mechanisms.md` and the registry for the routine's FAMILY
  and its callers. After a run, grep your own log for counterexamples to every universal you are
  about to write.

  Four instances, one night:
  1. A proposer's falsifiable prediction read *"a read tap at the entry must count exactly one
     dispatch."* The real tap counts **3,291,149** — its "one" was our JS harness entering a JS
     function once, R3a `[code]` wearing `[seen]` clothes, inside a prediction whose whole purpose
     was to be falsifiable against the ROM. A confirmer reproducing it literally **kills a correct
     name**: worse than a false positive, because it destroys good work quietly.
  2. A pass reported 55 pokes producing 55 dispatches. Both were cut off by the same run-end — the
     real count is 56 — so the correspondence was **manufactured by the measurement window**.
  3. Nine gates with no ROM guard, found by RUNNING the suite with no ROM (see R26).
  4. A `mechanisms.md` section headed *"The nibble-pair drawer draws DECIMAL digits, not
     hexadecimal"* refuted a proposed name before any run. The pass found it at minute twelve,
     after all six MAME runs — roughly half the pass spent re-deriving a committed heading.

  ★ The first three are the sentence outrunning the log. The fourth is nobody reading the log at
  all. Same disease, opposite faces.

- **R28 [ALL]** Derive a check from the RANGE OF LEGAL VALUES, never from the case in front of you.
  A check written from the expected value rejects compliance at the boundaries, and it passes on
  today's example BY CONSTRUCTION — so it has never been tested against anything but the thing it
  was copied from.

  *Two instances, on instruments written to police each other. A ceiling of "exactly one new module
  per commit" flagged a compliant ZERO-module pass, and once relaxed flagged a compliant
  one-routine lift at TWO, because its pattern counted the module and its test together. Wrong
  boundary in both directions, on one rule, within hours. And a gate's `EXCLUDED` register set,
  written to match the module rather than derived from the oracle, ASSERTED the divergence: green
  on a broken module, red on the correct one — and the module it defended hung the game.*

- **R29 [ALL]** When a commit was previously BLOCKED and is re-presented because a qualifying
  commit has since landed, audit whether the unblocking commit is SUBSTANTIVE — not a shim created
  to satisfy the rule.

  Verify: read its diff; confirm it does the work its subject claims; confirm it has its own
  grounding record where its class requires one; confirm it was itself reviewed, a recorded review
  token being the strongest single check.

  *Any rule of the form "X is allowed once Y exists" has this hole, and R1 is only the instance we
  hit. A reviewer derived this check unprompted when a decompile it had blocked came back after a
  pass appeared — and verified that the pass was substantive, had a grounding record, and had
  itself been blind-reviewed and BLOCKED once.*

- **R30 [ALL]** Before presenting a unit, run the cheap pre-flight checks that have blocked units
  of its class before. Rounds are the price of unchecked work, not of rigour — when review looks
  expensive, ask how many of its rounds existed to catch something the author could have caught
  alone.

  *Three units went through review in one day, same reviewers, same gates. Two took several rounds;
  one took a single round with no blockers. The one that passed first time differed in exactly one
  respect — its failure modes were checked before the reviewer saw it. For a routine promotion those
  checks are: does naming it leave a stale alias anywhere, does its declared range swallow an
  already-named routine, do its comments cite anything outside their own file. Each had cost a round
  on an earlier unit. The multi-round units were not blocked on hard questions; they were blocked on
  claims their author had not verified, and on a scripted edit whose blast radius he had not checked.*

  ⚠️ *This rule deliberately carries no figures. It first shipped with a table of round counts and
  durations, and a reviewer checked them: the round count double-counted a re-adjudication, one
  duration contradicted its own report, two were not derivable from anything recorded, and a "six of
  seven" was six. A rule arguing against unverified claims had five of them in its own table — see
  R19.1. The lesson never needed the numbers; only the wish to sound precise did.*

## R31 [ALL] A narrow brief still has to account for the whole diff

Scoping a review to the risk is correct — re-reviewing a change the owner specified himself is
waste. But **scope the JUDGEMENT, never the ACCOUNTING.**

Every narrow brief carries this as check #1, un-narrowed:

> Diff the staged file against `HEAD` and justify **every** removed or changed line. Anything not
> explained by the change's stated intent is a blocker. Confirm nothing was silently re-ordered.

It exists because a four-check brief once passed all four while the same edit had silently deleted
six unrelated things — an argument paragraph, a mechanics paragraph, a subject paragraph, a docs
link, a screenshot and two status blockquotes. The narrow checks could not see it; they were not
looking there. It was caught only because the reviewer read the diff anyway and chose to mention it.

**The cause is worth knowing, because the edit pattern is common.** A script replaced everything
between a heading and the next heading — and that span held more than the section:

```python
e = src.index("\n## ", s + 10)      # swallows whatever else lives in the span
```

★ **And the line count hid it: +1 net**, because ~74 lines of new code block replaced ~70 lines of
prose. **A near-zero net delta is the signature of a swap, not evidence that little changed.** Read
insertions and deletions separately; never reason from the net.

### R32 [ALL] The brief side of it: a disclosure must be RE-STATED every round

The accounting check is only as good as the list of authorized changes it is given, and **every
round gets a fresh, blind reviewer.** Anything you disclosed in round 3 does not exist in round 5.

This bit immediately. A layout line was corrected on explicit instruction, disclosed in two
successive briefs, and then dropped from the third — so round 5's reviewer, seeing a change outside
the commit's declared scope, correctly blocked on it. The change was authorized, deliberate, and
*more accurate than what it replaced*; the reviewer independently confirmed that. It was blocked
purely because the brief had lost its provenance.

★ **An authorized change whose authorization is not restated is indistinguishable from collateral
damage** — and it must be, otherwise the accounting check would have to trust the author's memory,
which is the thing it exists to replace. **The reviewer was right to block; the defect was in the
brief.**

So: keep the list of authorized deviations in the *unit's* notes, not in your head, and paste it
whole into every round. Carrying it forward costs a line. Losing it costs a round.

And when it happens, the remedy is to supply the sign-off **in writing, to that reviewer, and let it
re-adjudicate** — not to wave the finding away. Offer it the option of holding the block: an
authorized-but-unrelated change may still belong in its own commit, and that is the reviewer's call
to make.

## R33 [ALL] Generating a quote fixes drift and introduces range errors

Two failures on the same document, one after the other, and the fix for the first caused the second.

**First: a hand-copied code block silently lost four comments**, and was then reported as "verified
verbatim". Transcription drifts, and the drift ran in the direction of the surrounding argument —
which is the dangerous direction, because *tidying* a quote and *shading* one are the same edit and
a reader cannot tell them apart.

⇒ **So generate quotes from their source by script.** Verbatim then holds by construction rather
than by care, and the claim can be re-checked mechanically afterwards.

**Then: the generating script deleted six unrelated things**, because it replaced everything between
one heading and the next and that span held more than the section.

★ **A script's blast radius is not what you aimed it at — it is what its bounds actually span, and
you cannot eyeball a span you did not compute.** Generation removes one failure mode and adds
another; it needs its own guard, not fewer.

The guard is the accounting check above, plus: prefer replacing a **named, bounded** region over
anchor-to-next-anchor, and after any scripted edit assert that every pre-existing paragraph either
survives or is explicitly accounted for.

## R34 [ALL] The pixel gate must be ON, and green, for any commit the interlock fires on

**Applies to the first decompile unit of any game, and to every commit the interlock fires on.**
`hooks/pre-commit` enforces this automatically — `tools/pixel_gate_required.py check` refuses any
commit whose staged diff touches, for some game, its `idiomatic/`, `translated/`, `routines.js`,
`machine.js`, `manifest.js`, its own `tools/render.js` or `tools/pixel_suite.py`, or its
`boards/<board>/` directory — unless that game's suite prints its literal `PASS` line. **So a
plain `translated/` lift fires it too**, and a reviewer on such a commit owes the verdict line
just as much as one reviewing an idiomatic batch. Your job is to check the enforcement was not
waived, and to run it yourself where it could not be:

```
make pixel GAME=<game>          # or: python3 games/<game>/tools/pixel_suite.py
```

Not every game's gate is a `pixel_suite.py` — Donkey Kong's are `move_suite.py` and
`prize_suite.py`. `make pixel` delegates to the declared suite for the game, so it is the honest
entry point; a game with no declared suite refuses loudly rather than reporting nothing to do.

**If the diff adds or changes an `EXEMPT` entry in `tools/pixel_gate_required.py`, that is a waiver
of this gate and it is yours to adjudicate.** An exemption is legitimate only when the suite
genuinely cannot run and the stated reason is one you can check. ★ **An entry waives the game until
someone removes it** — it is not scoped to the commit that added it, and it will silently waive
every later commit. Adjudicate it as permanent, because it is.

★ **Know what a PASS does not cover.** While a game's `manifest.runtime` is `"translated"`, its
suite renders the ORACLE and its idiomatic layer is dormant — a green pixel gate says nothing about
idiomatic code, because nothing renders it. Do not accept "pixel gate green" as evidence about an
idiomatic module in such a game; the honest statement is that the layer is unrendered and therefore
unmeasured. See [the pixel gate](pixel-gate.md).

**Paste the verdict line into your review, and accept only `PASS`.** The other outcomes are not
passes and do not look like failures:

- `pixel_suite: SKIP -- no mame on PATH` / `SKIP -- romset ... not found` — you have checked
  nothing. This is the false green: a reviewer with no romset sees no failure and writes
  "confirmed green."
- `INCOMPLETE` — the render delivered fewer frames than asked. An empty comparison is inconclusive;
  `pixel_gate.py` returns this verdict precisely so it cannot be read as a pass.

**If you cannot run it** (no MAME, no romset), say so in the review as an explicit UNVERIFIED and
do not clear the unit on this rule — hand it back to the author to run and paste. An absence is
evidence only if the instrument was shown able to detect presence.

Why the memory gates cannot cover for it: the per-routine equivalence gates and the assembled swap
compare RAM outside the stack window and a declared live-out. **Neither looks at a pixel.** A layer
can be green on every gate the loop runs and wrong on the glass, because no idiomatic module spends
T-states — which moves the foreground phase, the NMI's interruption point, and what the beam has
drawn when it fires. The DMA sub-frame raster position has no owner among the memory gates at all.

**Turning it on late costs the bisect, not the run.** Many green routines and one pixel diff is a
search problem; one routine and one pixel diff is a bug report.

*Written because a game's idiomatic layer ran a full day of batches — per-routine gates green,
whole-game swap green, suite green — with the pixel gate wired into nothing. Every gate reported
truthfully on what it measured; nobody had asked what none of them measured. Beware that `make
verify` is a disassembly decoder check defaulting to `GAME=dkong` — a green `make verify` says
nothing about pixels.*

## R35 [ALL] An exclusivity claim about a cell needs a WRITE TAP, not a scan

A staged claim of the form *"nothing writes this cell"*, *"its only writer is X"*, or *"the word
occurs nowhere"* must cite an instrument that could have seen a writer it did not name. A scan of
the image — by byte pattern or by decoded operand — is not that instrument, and the reviewer's job
is to ask which one produced the claim, because the diff shows the conclusion and never the tool.

Two ways such a scan comes back confidently wrong, both caught in one batch:
- **The address is never an operand.** A store through an index register (`ld (ix+d),a`) or through
  a register pair loaded earlier (`dec (hl)`) names no address at the writing instruction. A pair of
  cells was declared unwritten on a scan; a write tap found them rewritten 596 times each in a 200 s
  run.
- **The scan finds the site and stops.** Worse than blindness, because it looks like coverage: an
  operand scan located a routine's arm and therefore counted the routine, then missed a SECOND
  write sixteen bytes later in the same twenty-two-byte body.

So the failure is not "scans miss things" — it is that a scan's output is a lower bound wearing the
costume of a count. **Accept a floor stated as a floor.** Refuse a floor stated as an exclusivity.

Verify: grep the staged diff for the SHAPE. This list is a starting point and is NOT exhaustive:

```
git diff --cached | grep -niE "nothing( else)? (writes|stores)|no other (writer|program counter\
|setter)|(only|sole)[- ](writer|setter)|sole writers|exactly (one|two|three) (writer|program \
counter)|never written|occurs nowhere"
```

For each hit, that same comment or this pass's grounding report must name the tap. The trigger is
mechanical; whether the instrument named could have seen a writer it did not report is the
reviewer's judgement.

★ **A hit on this rule's own text is not a test of the trigger.** Check it against the prose in the
diff, not against the examples above. The first version of this recipe listed five literal phrases,
fired on its own examples, and read as validated — while missing `names.js`'s "and nothing else
writes it", which is this repo's canonical phrasing for the hazard and was the very claim used to
demonstrate that R35 works. A word list rots; this one will too. What does not rot is checking the
list against the corpus rather than against itself.

## R36 [ALL] A register in an EXCLUDED set that the routine does not clobber is dead weight

Equivalence gates declare the registers allowed to diverge from the oracle. That set used to police
itself: while a gate pinned the divergence EXACTLY (`deepEqual(moved, EXCLUDED)`), a green run was
proof every listed register really did move, or the assertion would have failed. But an exact pin
also goes RED when a rewrite IMPROVES and diverges on one register fewer — a gate that refuses the
fix — so those pins are being converted to subset checks, which cannot notice a padded set.

So ask, of any ALLOWED/EXCLUDED set a diff adds or widens: **what put each name in it?** A register
the routine does not actually clobber costs nothing to add, weakens the arm silently, and no gate
will ever complain. Tightness moved from the assertion to you.

Two things this is NOT. It is not an argument for restoring exact pins — refusing the better module
is the worse failure. And a register legitimately in the set needs no removal; it needs its
liveness recorded somewhere the next reader can find, which is what a crafted arm does.

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

  **Token handover has TWO halves. Both are load-bearing and neither substitutes for the other.**

  * **Sender**: quote the hash; NEVER assert equality. "Unchanged since you audited" is not
    checkable by the recipient. The hash is.
  * **Recipient**: compare against YOUR OWN anchor, recorded in your review file at the previous
    round — never against the hash the message supplies. A hash the sender derived from the current
    file cannot disagree with the current file.

  Therefore **a blind reviewer MUST record, in its review file, the blob hashes it anchored to.** A
  review that reports only a verdict cannot perform this check next round, and a superseded blob
  that was never staged is unrecoverable — it is not in the object database, so the review file is
  the only record that revision ever existed.

  *Why: a coordinator handed a reviewer a token saying both blobs were unchanged. False — one had
  been edited twice. But the message quoted the CORRECT current hash, so a recipient whose check is
  "re-hash the file, compare to the quoted hash" gets a PASS. Self-consistent, and it cannot fail —
  the same species as "a check that cannot fail is not a check". What caught it was the reviewer's
  own anchor from the previous round.*

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
it in idiomatic-generation.md; an earlier draft of this note claimed it "was already documented and simply was
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

*R22's thesis is not "nobody wrote it down." That was the first diagnosis and it was wrong.
`idiomatic-generation.md` has required the `ROUTINES` entry all along — once as one of the four
artifacts a decompile batch delivers, and once in a sentence that names Donkey Kong as the worked
precedent, mechanism included. Both were on the page, and Donkey Kong's unwired batch is still
unwired: committed modules with green gates that no entry names and no sibling imports, so nothing
but their own tests ever call them.
That is the finding worth carrying. A requirement whose omission changes nothing observable is not
enforced by being true, or by being written twice, or by being written beside its own precedent.
An isolation gate cannot ask whether anything dispatches the routine, so the gap stays hidden in
exact proportion to how many of those gates are green — which is why the rule needed a consequence
and not a third restatement.
Two corrections this rule's own review had to make, both to confident claims by the author and the
lead, and both worth reading as the same species of error the rule is about. "No doc says it" came
from a grep too narrow to find the sentence it was looking for. And Time Pilot was reported as
having shipped its whole layer unwired; it had not — its commits wired 1:1 except one, which the
very next commit repaired by title. Time Pilot's layer WAS executed by nothing, for a different
reason this rule does not catch: `manifest.runtime` said `"translated"`, so the player never called
`resolveAllIdiomatic`. Registry coverage and a live layer are different properties. Prompted by
qarl asking how the docs change so the layer gets wired and used immediately.*

- **R31 [ALL]** A confidently-read idiomatic cell owes a DESCRIPTIVE name (runbook: a cell earns its
  identifier at the `[guess]`→`[code]` transition, not at grounding). FAIL any `export const loc_<addr>
  = 0x...` in a game's idiomatic `names.js` — `loc_<addr>` is the translated layer's identifier and is
  never a valid idiomatic CELL name; a confident cell (`[code]` **or** `[seen]`) still named `loc_<addr>`
  is an unfinished job, and an unknown-role cell is keep-hex (a bare literal, no const), so a `loc_` cell
  const is always the violation. Every reader pays the `mem16[loc_83ef]`-vs-`mem16[HIGH_SCORE]` tax the
  idiomatic layer exists to remove. (Idiomatic ROUTINE modules kept `loc_<addr>` are a separate question,
  not this rule.) *Recorded 2026-08-15: role-understood `[code]` cells persisted as `loc_<addr>` in the
  frogger `names.js` because the `[code]`-level naming pass was never run as its own step and nothing
  enforced it (most such cells predated the session); qarl: "code cells should have descriptive names
  too." Backfill owed -- a value-identical naming sweep over the cells grandfathered in `names-debt.txt`;
  the `names_consistency` gate rule (B) now FAILs any new `loc_` cell, and becomes fully debt-free once the
  sweep runs.*
