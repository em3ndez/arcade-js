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
    like `018c`'s, each needing its own mutation test. Not a rider on a mechanical batch.
  - **`equivalence-0365`'s allowed set is every main register**, so its arm keeps teeth only on ix,
    iy and the shadow set -- 10 of REG_FIELDS' 19. Its header says so. Flagged, not narrowed.
