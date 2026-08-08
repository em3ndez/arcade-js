# Plan: the exact-shape divergence pin ("inverted gates")

## The construct, located and reproducible

```js
const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
assert.deepEqual(moved, ["f", "sp"],
  "the excluded set changed shape: only the flag byte and the stack pointer may differ");
```

`a` is the oracle, `b` the candidate. The assertion pins the divergence set **exactly**. Improve
the module so it diverges on one FEWER register and `moved` shrinks — and the gate goes **RED on
the better module**. That is the defect: a gate that requires a wart refuses the fix.

## Measured spread (timeplt gates)

    129   gates declare a MOVED / EXCLUDED set
     14   declare ONLY structural registers -- [sp] (6) and [f,sp] (8)
    115   declare at least one general-purpose register (a,b,c,d,e,h,l,ix,iy)

Most common shapes: `[a,f,sp]` 29 · `[a,f,d,e,h,l,sp]` 11 · `[a,f,h,l,sp]` 9 · `[f,sp]` 8 ·
`[sp]` 6 · `[a,f,b,c,d,e,h,l,sp]` 5.

The 14 structural-only ones are harmless in practice and can stay: no idiomatic module models
flags, and `withOmittedRet` always moves SP, so those sets cannot shrink. **The 115 are the class.**

⚠ **SUPERSEDED — the figures in this opening section are the campaign's FIRST estimate.** They count
gates that DECLARE a set; the class is executed PINS, and the measured figure is in the batch-3
pre-flight below. Read that section for any number you intend to act on. 129/115/14 here, 94 after
batch 1, 66 in the handoff, 73 measured: same campaign, four different objects and four different
instruments. This block is kept because the reasoning is still right, not because the counts are.

## ★ What this plan CORRECTS about the earlier framing

Two prior numbers do not survive being re-derived, and both were over-counts produced by grepping
the wrong construct:

- A crude `notEqual` grep gives **263 over 197 files**. It is garbage. `assert.notEqual(entry,
  null, "vacuous: the tape never reached the routine")` is a **POSITIVE CONTROL** — the good
  pattern — and there are **423** of those. Counting them as defects inverts their meaning.
- A second pass over "candidate-vs-oracle pins" gives **41**, of which exactly **one** is the
  structural seam and ~35 more are *also* positive controls in a different dress ("the poke must
  actually change the byte", "the two fill bytes must actually differ").

The real construct is not `notEqual` at all — it is `deepEqual(moved, EXCLUDED)`. Any number
quoted for this class that was derived from a `notEqual` grep is measuring positive controls.

## The fix, one shape for the whole class

Replace the exact-shape assertion with a **subset** assertion:

```js
const unexpected = moved.filter((k) => !ALLOWED.includes(k));
assert.deepEqual(unexpected, [],
  "a register diverged that this routine's declared live-out does not permit");
```

- A module that diverges **more** still fails — full detection power retained.
- A module that diverges **less** now passes — the wart is no longer required.
- No loss from dropping the "stopped diverging" signal: a register in the excluded set is by
  definition dead for this routine, so the module ceasing to write it cannot break a caller. If a
  register is genuinely live it must not be in the excluded set in the first place, and the
  separate live-out assertion is what enforces that.

## Method — and the trap to avoid

★ **Script the FINDING, never the FIX.** A class-wide string replace propagates whatever is wrong
with the first case into all 115. The script emits a worklist; each gate is edited and re-run.

Per gate, the check that it is really fixed is a **two-way mutation**:
1. Make the module diverge on an EXTRA register → the gate must still go RED. (Detection kept.)
2. Make the module diverge on one FEWER register → the gate must stay GREEN. Under the current
   exact-shape assertion this goes RED, which IS the defect, so this is the discriminating arm and
   it must be run on the before-state too, or the fix is unverified.

Controls first: an unmutated run must be green, or neither arm means anything.

## Sequencing

This is not fix-as-you-go. It is one unit per batch of gates, each batch independently reviewed,
with the two-way mutation evidence in the commit. `[sp]`/`[f,sp]` gates are out of scope and
should be recorded as deliberately untouched rather than silently skipped.

★ Do this AFTER the authoring batch lands: batch 1's 19 gates would otherwise be written against
the old shape and immediately need the same edit.

---

# ★ SCOPE, measured with an argument-aware scan (2026-08-08). The 115 above is the right order.

The estimate at the top of this file — 129 declaring, 115 with a general-purpose register — is
approximately correct. A narrower scan run later put the sweep at 27; that figure is unsupported
and the table below supersedes it. The four-fold gap is worth understanding rather than just
overwriting, because the narrow scan was built to correct an over-count and produced an under-count
in the direction that made the job look nearly done.

Measured with a scan that resolves the expected side rather than requiring a literal (it does NOT
accept any left-hand side — see the batch-3 pre-flight, where that phrasing is retracted):

    ⚠ SUPERSEDED by the batch-3 pre-flight below (73 / 26 / 47). Kept for the reasoning.
    120  gates carry an EXACT pin whose expected set contains a general-purpose register
     26  of those are converted in this unit
     94  STILL CARRY THE DEFECT
     34  further gates pin structural-only sets, re-derived with the SAME scan as the rows above:
            [sp] x18, [f,sp] x15, and [f] x1. The first two are out of scope -- nothing models
            flags and `withOmittedRet` always moves SP, so those sets cannot shrink.
            ★ `equivalence-43e8` pins to ["f"] with NO SP, so that justification does not reach it.
            It is IN SCOPE and unfixed; it is listed here so it is not lost to the parenthetical.

So the original estimate of 115 was approximately correct and my "correction" of it was the error.

### HOW THE NARROW SCAN GOT 27 — ⚠ SUPERSEDED, the mechanism below does not reproduce
⚠ Read this section for its LESSON, not its diagnosis. The committed scan measures the stated
mechanism directly: keying the left side on the bare identifier `moved` yields 13 pins, of which
**zero** are in the class — so that cannot be what produced 27. Whatever did is unknown. The rule
the section draws (scan for the cause, count the symptom independently) survives intact and is the
reason this campaign has a pre-flight; the causal story attached to it does not.
My scan required the assertion's LEFT side to be the bare identifier `moved`. The construct is
written at least four other ways, all identical in effect:
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k])   inlined, never assigned  -- the big one
    REG_FIELDS.filter((k) => moved.has(k))              a Set built earlier
    movedRegisters(candidate)                           a helper returning the same set
    r.moved  /  [...moved].sort()                       a property, and a sorted copy
Every one of them was invisible. I widened the instrument three times and stopped when it "stopped
finding more" -- which is not a stopping rule, it is the absence of a stopping rule. **A free
positive control was sitting there the whole time and I never ran it:** 126 files at HEAD carry the
failure string `"the excluded set changed shape"`, against the 40 pins my scan claimed to find. A
three-fold gap between the symptom count and the cause count, one grep away.
⇒ R35 in `reviewer-rules.md` says a scan's output is a lower bound wearing the costume of a count.
This section asserted a FLOOR and then drew count-shaped conclusions from it -- "roughly a quarter
the size", "one or two units, not a campaign". The word FLOOR appeared; the reasoning ignored it.
⇒ **RULE, and it is cheap: when you scan for a DEFECT, also count its SYMPTOM independently. If the
two disagree by more than a rounding error, the scan is the thing that is wrong.**
★ **AND THE SYMPTOM COUNT IS A FLOOR TOO — apply the rule to the rule.** Measured at HEAD: the exact
string above appears in 126 files, `"excluded set changed shape"` without the article in 127,
`"changed shape"` in 155, and a separate phrasing `"excluded register set changed shape"` in 25 more
that the first pattern never matches. A symptom count taken from one phrasing reproduces, one level
up, the mistake it was written to catch. Cross-check with the loosest phrasing you can defend.

### Two further claims from that scan that do not hold
The two register-sorting gates are `2b83` and `5211`; neither is counted by the narrow scan and
neither is fixed, so "both are already counted" is false. And its stated blind spots named the
EXPECTED side, where every set resolved correctly -- the leak is on the LEFT side, which is the
side it could not see.

### What this means for sequencing
94 gates remain. That IS a campaign, and the plan's original framing was right: one unit per batch,
each independently reviewed, with the two-way mutation evidence in each commit. The 26 in this unit
are a first batch, not a finished sweep, and the commit message must say so.
### ★ BATCH 3 NEEDS NO PRE-EMPTIVE FIX — measured, not assumed
The plan's sequencing note says to wait for the authoring batch so its gates are not written
against the old shape. Checked: of the 18 untracked batch-3 gates, **zero** use
`deepEqual(moved, …)`. The authoring agents did not reach for the construct. So the batch imposes
no double edit, and the sweep does not have to wait on it.

---

# ★★ BATCH-3 PRE-FLIGHT (2026-08-08). THE CLASS IS BIGGER THAN 66. The instrument is now committed.

`scratchpad/scan-inverted-gates.py` is the campaign's scan. **Run it, do not rebuild it** — three
of the four scope figures this campaign has quoted came from an instrument built fresh and trusted
once, and each was a floor. It reads its register vocabulary from `core/cpu/z80.js` and prints its
reconciliation, its untracked-file exposure and its selector contribution as part of every run.

⚠ **THE SCAN READS A WORKING TREE, so these figures reproduce only against `a805666`** — the head
of batch 3, before a single conversion. Run it mid-batch and every count is lower, correctly, and
looks like the table is wrong. It takes the root as an argument for exactly this:
`scan-inverted-gates.py /tmp/clean-checkout`.

⚠ **IT ALSO COUNTS UNTRACKED GATES.** Eighteen sit in the tree today (the R1-gated authoring batch)
and contribute nothing to the class, but a future batch measuring mid-authoring would silently fold
uncommitted gates into "the class". The run prints the count so the exposure is visible rather than
disclosed in a document nobody re-reads.

⚠ **THE MESSAGE SELECTOR FINDS NO PIN THE OTHER ONE MISSES — but do NOT delete it.** It contributes
zero unique PIN rows, and that is the whole of what can be claimed. It uniquely supplies three
UNRESOLVED rows (`15b6:188`, `2a57:455`, `50ee:445`); removing it drops them from hand judgement,
and two of the three are half of the four-file SYMPTOM-BUT-NO-PIN residue enumerated below. The
genuine second COUNT is the symptom grep, and only that. It was added believing it recovered
`0ce8`, `1253` and `2bef`; it recovers none of them.
★ **This bullet said "contributes ZERO unique rows" through FOUR review rounds, and the instrument
agreed with it, because the contribution counter could not see unresolved rows** — they were skipped
before it ran. The count printed zero while the three rows printed a few lines below it. Fixed: the
counter spans both buckets. The control is one `sed` replacing the pattern with something
unmatchable and one `diff` of the output — cheaper than any of the four rounds that missed it.
⚠ An earlier repair of this bullet said "two rounds". It was four, and a self-critical count that
errs toward flattering the author is the exact failure this document is about.

⚠ **ITS LINE NUMBERS ARE APPROXIMATE.** `PIN` is DOTALL with a non-greedy left side, so a preceding
non-matching `deepEqual` swallows the following pin and the reported line is the earlier one —
`2cbc` reports about seventeen lines early. Corpus-wide, 21 matches swallow 22 `deepEqual` openings;
of the rows the scan PRINTS, one emitted row and thirteen unresolved rows are swallow artifacts. No pin
is lost to the swallow today, because each swallowed opening resolves to the same assertion — but
**this is not hypothetical**: `2bef`'s two pins at 304 and 309 already sit under one swallow, and
they escape only because neither is independently matchable anyway. Use the worklist to find FILES,
then grep the file. An earlier draft said "exactly one swallowed site", which was true only of the
emitted rows and read as though it were true of the corpus.

⚠ **ONE MORE DROP, AND IT WAS LIVE WHILE BEING DISCLOSED AS INERT.** `register_set` returned a bare
`None` for several expected-side shapes — the same mechanism that hid the six shadow gates. It was
hiding two more the entire time: `deepEqual([...r.moved], [EXCLUDED], …)` at `0ce8:355` and
`181d:333`, an identifier INSIDE the array, so no string literal is found. Both are genuine exact
pins. Both have `EXCLUDED = "sp"`, so the class of 73 is unaffected — but **structural-only is 34
by scan PLUS those 2.** Now fixed: every failure path reports for hand judgement instead of
dropping. The previous draft of this bullet described the drop as "0 cases today" while two cases
sat in it, which is the campaign's own thesis happening inside the paragraph written to close it.

⚠ `PIN` also requires a message argument, so a message-less `deepEqual` cannot match. There is
exactly **one** in the timeplt gates, `0f11:334`, and it is not a register pin. An earlier draft
said 98 — a figure transcribed from a review rather than measured.

    73   exact pins containing a register outside {f, sp}, across 72 files   <- THE CLASS
     4   further executed pins, in 2 files, that the WORKLIST does not carry (below)
    34   structural-only BY SCAN: [sp] x18, [f,sp] x15, [f] x1 -- unchanged from batch 1's table.
         ★ The true figure is 36: `0ce8:355` and `181d:333` both pin `[EXCLUDED]` with
         `EXCLUDED = "sp"`, and were silently dropped until this batch made the drop report.
   104   files carrying the loosest symptom string, the independent count

**The previous figure of 66 was low by six**, and the six are named below. ⚠ An earlier draft of
this section said seven, which was `73 pins − 66 files` — a subtraction across two different units,
presented as a count of gates. Ablating the committed scan gives the honest answer: hand-authored
vocabulary 67 pins / 66 files, vocabulary read from `z80.js` 73 / 72, and the entire delta is six
pins in six files.

**Separately** — and these two facts have nothing to do with each other — the residue between the
pin count and the symptom count is enumerated rather than estimated: 4 symptom-files with no pin
(2 already converted, plus `1253` and `2bef` below) and 3 pin-files whose failure message is phrased
differently (`08ae`, `43e8`, `46ba`). ⚠ That is also seven files, and the draft welded the two
sevens into one sentence reading as though the residue accounted for the delta. It does not. Two
unrelated quantities that happen to coincide, presented as arithmetic.

### THE EXEMPTION IS TWO REGISTERS, AND IT IS DERIVED RATHER THAN LISTED
The "cannot shrink" carve-out covers exactly `f` (nothing models flags) and `sp` (`withOmittedRet`
always moves it). **Every other name in REG_FIELDS can be preserved by a better rewrite, the eight
shadow registers included** — so the class is the complement of those two, not a hand-kept list of
"general-purpose" names. The six newly-visible gates are exactly the shadow-bearing ones: an earlier
hand-authored vocabulary omitted `a_`…`l_`, and a set mentioning one failed validation and was
dropped whole. They are `0809`, `13cc`, `33b8`, `4b30`, `4b4b`, `4fbf` — six named, six counted.

### THREE INSTRUMENT ERRORS IN ONE PRE-FLIGHT, each returning a plausible number
Recorded because the pattern is the campaign's subject, and it recurred while measuring it:
  1. keyed on the EXPECTED side being a literal array → **10 rows, 9 of them in the class**. The
     dominant form is a named const. (The tenth is `0ce8:399`, which error 3 separately hides, so
     "10 of the 73" — an earlier draft's phrasing — is arithmetically impossible.)
  2. resolved the const but hand-authored the register vocabulary → **67**. Sets naming a shadow
     register were dropped silently; a dropped case is indistinguishable from an absent one.
  3. narrowed candidates by the measured side matching `REG_FIELDS|moved|regs[` → dropped `0ce8`,
     whose measured set is named `surviving`. **ONE false negative, not three.** An earlier draft
     said this also lost `1253` and `2bef`; both of their measured sides DO match the filter
     (`REG_FIELDS.filter(…)` and `moved(…)`), and both are lost further downstream, to const
     resolution. The scan's own comment says this correctly while this bullet said the opposite,
     in the same commit.
★ **None of the three errored. Each returned a smaller, healthier-looking class.**
⚠ **AND THE TWO-COUNT RULE DID NOT CATCH ALL THREE — it caught two.** The signal is the
SYMPTOM-BUT-NO-PIN gap: error 1 leaves 80 such files and error 2 leaves 10, both screaming. **Error 3
leaves 4 — the same four files the correct scan leaves.** Nothing in that run's own output says a
row is missing, which is what makes the narrowing the one error a cross-check cannot see.
⇒ Correcting error 3 DOES move the pin counts: the class goes 73 → 74 over 72 → 73 files, and
`0ce8` joins PIN-BUT-NO-SYMPTOM. So the honest statement is about the GAP, not about the whole
output — an earlier draft called error 3's reconciliation "bit-identical to the shipped scan's",
which is a comparison that cannot fail, since **the shipped scan still carries error 3** (its
docstring says so: `DIVERGENCE_LHS` is what loses `0ce8`). Shipped compared against shipped.
⇒ That draft also said the lost row "carries neither a changed-shape message nor a countable pin".
Half right. `0ce8:399` pins `["a","h","l"]` and IS a countable in-class pin — counting it is exactly
what moves 73 → 74. Only the message half holds.
⇒ The rule is still worth its cost; it caught the two errors that moved the class by tens. But "it
caught all three, one run each" was a claim about the rule made by the person the rule had just
rescued, and it took two further rounds to reduce to what the measurement supports.

### ⛔ PRE-STAGE CHECK THE SWEEP CREATES AND NOTHING ELSE CATCHES
A teeth arm works by CLOBBERING a register inside the idiomatic module, so every sweeper dirties
files outside its own assignment for as long as its mutation is live. Mid-batch, `git status`
legitimately shows modified modules. **A mutation left behind is a corrupted shipped module**, and
staging explicit paths hides rather than prevents it — the file simply stays dirty until some later
batch sweeps it up.
⇒ **Before staging: `git diff --stat games/timeplt/idiomatic/*.js` must be EMPTY.** Not "reported
reverted by the agent" — empty. This is cheap, and it is the only check between a mutation arm and
the shipped layer.
⚠ **AND IT IS ONLY MEANINGFUL AFTER EVERY SWEEPER HAS REPORTED.** Polled mid-run it goes clean and
dirty repeatedly, once per arm per agent, so a poll that happens to land between one agent's revert
and another's next clobber reads EXACTLY like the end state. I armed a waiter on this condition and
it fired with all five agents still running. The check is `all agents done` AND `diff empty`, in
that order — a clean tree at an arbitrary instant is not evidence about the final tree.

### TWO GENUINE MEMBERS THE WORKLIST DOES NOT CARRY — convert by hand
Both are 2 FILES holding 4 executed pins. Counting sites in source is not counting the assertions
that run, and this class hides arms behind loops and helpers.
  - `1253`, its `deepEqual` at line 305 — expected side is a computed local `expected`, not a const.
    ⚠ **The scan DOES report this one, by name, in its unresolved list**, which is what that list is
    for; it is absent from the WORKLIST, not from the output. Saying "no selector reaches it" was
    wrong. It is ONE textual assertion driven twice by a loop over `[LIVE_POINT,
    EXCLUDED_QUEUEING]` and `[TEARDOWN_POINT, EXCLUDED_TEARDOWN]` — one edit fixes both arms, but
    both must be re-run.
  - `2bef`, its two `deepEqual` calls opening at lines 304 and 309 —
    `moved(r.movedRegs.arrived)` against `moved(new Set([…]))`, and the same for `.turning`. The
    expected side is a CALL wrapping a Set literal, so no array ever appears in source position and
    no regex over the expected side will ever find these. ⚠ **But the scan DOES print
    `equivalence-2bef.test.js:304` in its unresolved list**, and 304 is the exact opening line of
    the first pin — only the resolved identifier (`CORPUS_FRAMES`) is a swallow artifact. So the
    output names the file AND the line for both of these; what it cannot do is CLASSIFY them.
    Round 2 blocked this same over-specific claim about `1253`; the repair fixed `1253` and made
    the identical claim about `2bef` two lines later.

### ★ THE DEFECT IS DEMONSTRATED, not argued — run on `equivalence-3e63` before any edit
    CONTROL, gate untouched .................................. 8 pass, 0 fail
    ARM, module IMPROVED to also preserve the accumulator .... 7 pass, 1 FAIL
      "the excluded set changed shape" -- expected ['a','f','sp'], actual ['f','sp']
The improvement was simulated by making the candidate agree with the oracle on `a` after the call,
which is exactly what a rewrite that stopped clobbering the accumulator would produce. The gate
goes RED on the strictly better module. Gate restored, `git diff` clean.
⇒ This is the "before-state" run the plan demands, and it is now on record for the whole class
rather than owed per gate. Each gate's own fix still needs the EXTRA-divergence arm to prove
detection was kept.

### ★ WHAT THE FIX GIVES UP, named by the group-2 sweeper rather than by the plan
The exact-shape assertion carried a guarantee nobody wrote down: **while it was green, the allowed
set could not be too wide** -- every register listed demonstrably DID diverge, or the deepEqual
would have failed. The subset assertion trades that away. A future author can pad an allowed set
with a register that never diverges and no gate will notice.
⇒ That is a real loss and the plan accepted it without noticing it existed. It is also the right
trade -- a gate that refuses the better module is worse than one that tolerates a padded set -- but
the replacement enforcement has to go somewhere, and per `rules-for-reviewer-not-new-gates` that
somewhere is a REVIEWER rule, not a new gate:
    a register in an ALLOWED/EXCLUDED set that the routine does not actually clobber is dead
    weight; ask what put it there. Tightness used to be enforced by the assertion and is now
    review-only.
Landed as R36 in reviewer-rules.md WITH THIS BATCH, not at the end of the campaign: the guarantee
is gone for these 26 from the moment they commit, so the replacement has to arrive with them.


## OPEN ITEMS — this file is the campaign's tracking document, so they live here, not in a review

  - **73 pins at the head of batch 3, 47 after it lands**, plus 4 executed pins in 2 files the
    worklist does not carry — pins throughout, never files; measured
    at the head of batch 3, superseding the 94 recorded after batch 1 and the 66 carried in the
    handoff. Per-unit pre-flight: run `scan-inverted-gates.py`, which does both counts, and
    reconcile them before presenting. A unit whose two numbers disagree is not ready.
  - **`equivalence-43e8` pins to `["f"]`** -- structural-looking but with no SP, so the
    "cannot shrink" exemption does not reach it. IN SCOPE, unfixed.
  - **`equivalence-0f11`** is the first live instance of the guarantee this sweep gives up: `h` sits
    in its allowed set legitimately, but nothing now records that `h` does not move at the captured
    entry. Deferred deliberately -- it is an evidence judgement, not a conversion, and doing it
    properly means either narrowing the bound to the measured set or building a crafted-carry arm
    like `018c`'s — but 018c's own crafted arm is defective (see the one-step case), so copy its
    SHAPE and not its assertion. Each needs its own mutation test. Not a rider on a mechanical batch.
  - **`equivalence-0365`'s allowed set is every main register**, so its arm keeps teeth only on ix,
    iy and the shadow set -- 10 of REG_FIELDS' 19. Its header says so. Flagged, not narrowed.
  - **`equivalence-0ce8` is PERMANENTLY DECLINED**, not an oversight in any batch. Its set is built
    by corrupting a register AFTER calling the oracle, so the candidate never appears and it
    measures the instrument's sensitivity rather than the rewrite's divergence; the subset form is
    blind to it collapsing to empty, reachable because `replay` catches and returns `forked: true`.
    Batch 1 demonstrated it: exact pin 1 FAIL, subset form 15 pass / 0 fail.
    ★ **A WORKLIST REGENERATED FROM THE CODE HAS NO MEMORY OF THE JUDGEMENTS MADE ABOUT THE CODE.**
    Batch 2's generator matched on shape, and this gate has the shape, so it was re-emitted and
    pulled out by hand.
    ⚠ **THE HAZARD INVERTED IN BATCH 3 AND THE INSTRUCTION IS NOW A NO-OP.** `scan-inverted-gates.py`
    does NOT re-emit it: its measured side is named `surviving` and its message reads "the set of
    unmeasurable registers moved", so it matches neither the divergence-LHS selector nor the
    message selector. It is now SILENTLY ABSENT. A future batch that follows the old instruction
    will "pull it out", find nothing, and have no way to tell that from having pulled it out --
    an absence that looks identical whether the judgement was honoured or the scan simply went
    blind. ⇒ **Assert the absence is the intended one: grep 0ce8 in the WORKLIST and expect zero
    BECAUSE of the named selector miss, not because the gate is gone.**
    ⚠ Scope that to the worklist, because `0ce8` DOES appear in the scan's output — two different
    assertions in the one file. Line 399 (`surviving`, the declined pin) is missed by both
    selectors and is the silent absence. Line 355 (`[EXCLUDED]`, a structural pin) is REPORTED in
    the unresolved list as of this batch. A reader who greps the whole output gets a hit and may
    conclude the declined gate was found.

## ★ THE DEFECT HAS A SECOND FORM, ONE LEVEL UP — found by batch 2, swept for the class

A batch-2 sweeper found `equivalence-20af:220`:

    assert.ok(EXCLUDED.includes("ix"), "the dropped index register must stay declared");

Under the exact pin this was a harmless restatement. **Under the subset form it becomes a
requirement that the allowed set stay WIDE** — the same "gate requires a wart" shape the campaign
exists to remove, now biting a future author who improves the rewrite to preserve `ix` and then
tightens the set to match. The conversion does not create it; it promotes it from redundant to
load-bearing.

Swept the corpus for `assert.ok(<CONST>.includes(...))` — 15 sites, of which TWO are this shape.
⛔ **THAT SWEEP IS A FLOOR AND WAS WRITTEN AS A COUNT.** It required an UPPERCASE constant on the
left. Loosened to any left-hand side, `assert.ok(...includes(` has **49** sites, 18 of them
`assert.ok(moved.includes(...))` — assertions on the MEASURED set rather than the declared one,
i.e. "this register must still diverge". Seventeen are `moved.includes("sp")`, harmless for the
same reason `4d2b` is. The eighteenth is WORSE than either case the narrow sweep found.
The two it did find:

    20af:220   EXCLUDED.includes("ix")   ★ GENUINE. `ix` is a general register; the set CAN tighten.
    4d2b:282   EXCLUDED.includes("f")    harmless -- nothing models flags, so `f` can never leave
                                          the set, and the assertion can never obstruct a fix.

The other 13 are not this class and must not be swept up with it:
  - `MAY_MOVE.includes(k)` inside a loop over the registers that actually moved (181e, 3deb, 3e6c)
    is the SUBSET FORM ALREADY DONE RIGHT — these gates were never inverted.
  - `WRITTEN.includes(d.addr)` x2, `CELLS.includes(d.addr)` (1a9a:199), `SLOTS.includes(...)` x2,
    `RECORDS.includes(...)`, `ERAS.includes(LAST_ERA)`, `HOSTILE_FILLS.includes(0x00)` x2 and
    `CALLER_TABLES.includes(t)` are positive controls and vacuity guards over cells, slots and
    eras — the good pattern. Ten, with the three `MAY_MOVE` above making thirteen.

### ★★ THE ONE-STEP CASE the narrow sweep could not see: `018c:394`
    const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);   // a oracle, b candidate
    assert.ok(moved.includes("h"), "the crafted entry did not move the cursor's high byte after all");
`20af:220` needs TWO steps to bite — improve the rewrite to preserve `ix`, THEN tighten EXCLUDED.
**This needs one.** A rewrite that leaves `hl` where the oracle leaves it drops `"h"` from `moved`
and the gate goes RED on the strictly better module: the campaign's own definition of the defect,
unmediated. It is LIVE — `df35ec6` converted this file's captured-entry pin to the subset form and
left this arm untouched, so the exact-pin regime that made it redundant is already gone.
★ **AND THIS FILE POINTED AT IT AS THE REMEDY.** The `0f11` deferral recommends "a crafted-carry
arm like 018c's". Following that propagates the defect into the fixes. What a vacuity guard must
assert is that the ORACLE moved `h` — entry state against oracle output — not that oracle and
candidate disagree on it. Only the first cannot be defeated by an improvement.

⇒ **OPEN ITEMS: `20af:220` (two-step) and `018c:394` (one-step, and the more urgent).** Neither
fixed in batch 2: removing either is a behaviour change beyond a mechanical conversion, and each is
the only in-code record that its register is deliberately dropped. Keep the record, remove the
obstruction.

### R36 items named by batch 2 — allowed sets that are wide or unrecorded, NOT narrowed
  - `0c39` `[a,f,h,l,sp]` -- `h`/`l` justified only by the file's own prose ("the caller reloads all
    of these before reading anything"), with no arm recording it. Same shape as the `0f11` deferral.
  - `07d2` `[f,b,d,e,h,l,sp]` -- seven of nine main registers, so its teeth now cover only `a`, `c`,
    the index pair and the shadow set. Every name was demonstrably moving under the old exact pin.
  - `1563` / `158c` `[a,f,b,c,d,e,h,l,sp]` -- every main register. Confirmed GENUINE SIBLINGS from
    the oracles (0x1563 scatters `ld a,(de) / ld (hl),a`, 0x158c gathers the inverse; same
    immediates, same `exx` split), so neither borrowed the other's set. Both headers now state what
    teeth remain (index pair + shadow set, 10 of REG_FIELDS' 19).
  - Unusually TIGHT rather than padded, noted only because they break the common shape:
    `01b5` `[a,h,l,sp]` has no `f`; `01c2` `[b,d,e,h,l,sp]` has neither `a` nor `f`.
★ All 27 batch-2 sets were verified tight at the moment of conversion -- every exact pin was green
at HEAD, which IS proof each listed register moved. That is the guarantee being spent, and it is
worth recording per batch that none of these was padded when it was converted.

### R36 items named by batch 3 — the WIDE sets, ranked by what teeth remain
All 26 batch-3 sets were verified tight at conversion: each gate's exact pin was green at HEAD,
which is proof every register listed really did move. None is padded. But tight is not narrow, and
`REG_FIELDS` has 19 names, so the number worth reading is what is still WATCHED:

    13cc   set 14   teeth  5  (ix, iy, a_, f_, b_)   ★ the widest gate in the campaign so far
    0809   set 10   teeth  9
    33b8   set  7   teeth 12    3252  set 7  teeth 12    339c  set 7  teeth 12
    2bb4   set  7   teeth 12    2a47  set 7  teeth 12

⚠ **An earlier draft named only `3252`, `2bb4` and `339c` and missed the two widest.** Batch 1 put
`0365` in OPEN ITEMS for keeping teeth on 10 of 19; `13cc` keeps teeth on 5 of 19 and was not
mentioned at all. R36 hands tightness from the assertion to the reviewer — this list IS the
hand-off, so omitting its largest members is the one way to break it.
`13cc` is wide but justified rather than lazy: its rewrite writes no register at all while the
oracle works through the alternate bank via `EXX`, and `b_` sits OUTSIDE the set, which is exactly
the discrimination padding would have destroyed. `339c` likewise excludes `l` and not `h`.

### SIX of the batch-3 gates pin a UNION, not a single-entry measurement
`0809`, `2b83` (its CORPUS arm), `303e`, `304d`, `308a`, `3e05` accumulate `moved` across a loop, so
"tight" means each member moved SOMEWHERE in the corpus, not at every entry. That was already true
of these arms before conversion and the conversion preserves it exactly — but it is a weaker
guarantee than the single-entry arms carry, and the difference is invisible in the diff. `2b83` sits
in BOTH camps — it has one union pin and one single-entry pin — so these do not partition the
twenty-five gates and no "the other N" figure is available here.
⚠ An earlier draft said two. Six is the measured answer.

### ★★ A MUTATION ARM PLACED BEFORE THE CODE THAT REWRITES THE REGISTER PROVES NOTHING
Found by a batch-2 sweeper on `0f7b`: its first detection arm clobbered `h` at function ENTRY and
the gate stayed GREEN, because `tableEntry()` overwrites HL further down. The arm was measuring a
value the routine was going to discard.
⇒ **CLOBBER AT THE EXIT, not the entry.** A green detection arm is not evidence the subset check is
too loose until you have shown the clobber survived to the comparison. Carry into every later batch;
this is the one way a detection arm can report the wrong answer and look correct doing it.

### The one deviation in batch 2, and why it is right — `equivalence-1098`
Its union pin IS the class construct (the union is candidate-vs-oracle divergence accumulated over
890 captured states, so a rewrite that stops moving `c` shrinks it and the pin goes red). But the
file ALREADY carried the subset assertion three lines above, built in the same loop against the
same set. Converting would have produced a literal duplicate.
What the union pin uniquely provided was TIGHTNESS -- proof each of {a,f,c,sp} really moved
somewhere in the corpus -- and that is exactly the guarantee this campaign spends. Tightness and
improvement are contradictory by construction: "exactly these moved" cannot coexist with "fewer may
move". So the pin is removed and the measured union is REPORTED in the arm's log instead.
★ This is NOT "a warning that does not halt": the SAFETY check is untouched and still an assertion
(`assert.deepEqual(widened, [], …)`). Only the measurement that can no longer be asserted became a
report, and the log shows it equals EXCLUDED, so that gate's set is demonstrably tight on the record.

