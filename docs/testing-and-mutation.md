# 4. Drafter testing & mutation

Translating a routine and *asserting* it's right are two different jobs. The process separates
them: a **drafter** translates a routine and ships it with the evidence that it works, and a
different reviewer integrates it. Author ≠ checker.

## What a drafter delivers per routine

For each ROM routine, the deliverable is not just the JavaScript. It is:

- The **byte/skeleton**: the exact ROM bytes and the instruction-level structure they decode to,
  so the translation can be checked against the disassembly rather than taken on faith.
- The **open questions and structure analysis**: the non-obvious decisions (is this jump a return?
  is this table 4 or 5 bytes per record? does this flag stay live?), stated explicitly, because
  those are where translations go wrong.
- A **drafted test**: a unit test that exercises the routine against ground truth — T-state charges,
  dispatch-table targets, fall-through, flag polarity — each assertion tied to a specific fact.
- A **mutation** (below).

## Mutation testing — proving the test has teeth

A test that passes tells you nothing unless you know it *can fail*. So every drafted test ships with
a **mutation**: a small, deliberate corruption of the routine (an anchor/replace patch) that the
test is supposed to catch. The format is a `MUTATION-PATCH` comment next to the assertion it
proves — the file, the literal `find`/`repl` text, the expected verdict, and a `verified-anchor`
count confirming the `find` text matches exactly the site that was mutated (see the examples in
`core/cpu/test/z80.test.js`).

Applying it is a **documented manual discipline, not an automated one** — there is no
mutation-runner tool. A reviewer walks the contract by hand, per patch:

1. Baseline: the test **passes** on the correct code.
2. Apply the mutation (hand-edit the source per the patch's `find`/`repl`). The test must now
   **fail** — recorded as `CAUGHT`.
3. Revert. The test **passes** again.

A mutation the test fails to catch (`NOT_CAUGHT`) means the test is asleep — it asserts something,
but not the thing the mutation broke — and the drafter is pinged to strengthen it. The anchor must
be the literal text the mutation was verified against, never a prose paraphrase re-derived later —
a paraphrase can match zero sites (silently skipping the check) or several (mutating more than
intended). This is the difference between writing a test and proving the test detects the failure
it claims to.

## ★★ Two rules about the CONTROL, learned from measurements that looked rigorous and were not

Both of these are the mutation discipline above, pointed at a measurement instead of a test. A
mutation proves a test can fail; a control proves a measurement could have come out differently.
Without one, a number is an assertion with a decimal point.

### A validation set you HAPPEN to have is not a validation set you CHOSE

An estimator for review duration had exactly one job: separate the minutes a reviewer spent working
from the minutes it spent waiting for a compute slot. It was validated against two cases whose true
durations were already known, and bracketed both. Only one of those two was ever checked for
queueing, and it had none — its own clock ran about three minutes under its elapsed time, all of it
spawn overhead. The other was never checked either way. The estimator was then applied to a
different population — reviews dispatched as one concurrent wave, where most of the elapsed time IS
the wait — and when one of those was later measured directly, it had overstated the case by better
than two-fold and its bracket did not contain the answer.

The validation could not have established that it would work, because the quantity the estimator
existed to remove was absent from the one case anybody checked for it and unexamined in the other.
They were the cases whose true durations happened to be recoverable, not cases picked to span the
estimator's failure modes. **Passing on the cases you
could easily check is exactly as much evidence as a mutant that any test would kill.** Both feel
like validation and neither discriminates.

- Choose validation cases the way you choose mutants: for their power to REFUTE. The case that
  would embarrass the estimator is the one worth spending a direct measurement on.
- Prefer a case that appears in BOTH datasets. The refutation above was available only because one
  routine had an estimate and a direct measurement — same subject, two numbers. That is a
  falsification; two numbers from different subjects would only have been a disagreement.
- State the validation set's size and how it was selected, beside the estimate. "Validated against
  two known cases" reads as rigour until you add how those two came to be the ones you had.

### Match the control on the variable that drives the QUANTITY, not the one that describes the SUBJECT

A clean review-duration baseline was to be matched to its comparison set on **ROM size**, on the
reasoning that ROM size is what makes a routine hard. It is — but a reviewer reads the DIFF, not
the ROM. Measured, the proposed subject's gate was larger than the largest gate in the set it was
to be compared against, so matching on ROM size would have skewed the baseline in the direction
that made the conclusion look strongest. By how much is not known: nobody measured how review
minutes scale with diff surface, and the arm's own figures suggest the relationship is far from
proportional.

**Ask what the number is a number OF, and control on that.** ROM size describes the routine; diff
surface drives the reviewer's minutes. Only one of those belongs in the cost model.

★ **Do not reach for your most-reviewed unit as a baseline.** The subject proposed here had been
through four review rounds — verified — and was carrying a gate larger than anything in the set it
would have anchored. Whether the rounds CAUSED that surface is a separate claim and this one does
not support it: the gate's own timestamps put its last change before the third round began, so
rounds three and four added nothing to it. What survives is the selection warning, which is enough:
the unit you scrutinised hardest is unrepresentative by construction, whatever made it so.
