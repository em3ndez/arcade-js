# Drafter testing & mutation

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

**Passing on the cases you could easily check is exactly as much evidence as a mutant that any test
would kill.** Both feel like validation and neither discriminates.

- Choose validation cases the way you choose mutants: for their power to REFUTE. The case that
  would embarrass the estimator is the one worth spending a direct measurement on.
- Prefer a case that appears in BOTH datasets. A refutation is available only when one subject
  carries both an estimate and a direct measurement — same subject, two numbers. That is a
  falsification; two numbers from different subjects would only have been a disagreement.
- State the validation set's size and how it was selected, beside the estimate. "Validated against
  two known cases" reads as rigour until you add how those two came to be the ones you had.

### Match the control on the variable that drives the QUANTITY, not the one that describes the SUBJECT

**Ask what the number is a number OF, and control on that.** ROM size describes the routine; diff
surface drives the reviewer's minutes. Only one of those belongs in the cost model.

★ **Do not reach for your most-reviewed unit as a baseline.** The unit you scrutinised hardest is
unrepresentative by construction, whatever made it so.
