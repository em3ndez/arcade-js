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

Measured with an argument-aware scan that accepts ANY left-hand side:

    120  gates carry an EXACT pin whose expected set contains a general-purpose register
     26  of those are converted in this unit
     94  STILL CARRY THE DEFECT
     34  further gates pin structural-only sets, re-derived with the SAME scan as the rows above:
            [sp] x18, [f,sp] x15, and [f] x1. The first two are out of scope -- nothing models
            flags and `withOmittedRet` always moves SP, so those sets cannot shrink.
            ★ `equivalence-43e8` pins to ["f"] with NO SP, so that justification does not reach it.
            It is IN SCOPE and unfixed; it is listed here so it is not lost to the parenthetical.

So the original estimate of 115 was approximately correct and my "correction" of it was the error.

### HOW THE NARROW SCAN GOT 27, because it is the same failure this file exists to describe
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

  - **94 gates still carry the defect.** Roughly four more units at this batch size. Per-unit
    pre-flight is now known: run the argument-aware scan AND the symptom count, and reconcile them
    before presenting. A unit whose two numbers disagree is not ready.
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
  - `WRITTEN.includes(d.addr)`, `CELLS.includes(d.addr)` (1a9a:199), `SLOTS.includes(...)` x2,
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

  - **`equivalence-0ce8` is PERMANENTLY DECLINED**, not an oversight in any batch. Its set is built
    by corrupting a register AFTER calling the oracle, so the candidate never appears and it
    measures the instrument's sensitivity rather than the rewrite's divergence; the subset form is
    blind to it collapsing to empty, reachable because `replay` catches and returns `forked: true`.
    Batch 1 demonstrated it: exact pin 1 FAIL, subset form 15 pass / 0 fail.
    ★ **THE WORKLIST GENERATOR CANNOT SEE THAT AND RE-EMITS IT EVERY BATCH.** The scan matches on
    shape and this gate has the shape. It was regenerated into batch 2 and pulled out by hand;
    every future batch must pull it out again. A worklist regenerated from the code has no memory
    of the judgement calls made about the code.
