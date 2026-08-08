// SPDX-License-Identifier: GPL-3.0-only
/**
 * `withOmittedRet` must treat a coroutine spine entry differently from an ordinary routine, and
 * this pins the difference so the branch is not dormant. Ordinary routines are wrapped, because a
 * translated caller dispatched into JS that never runs a `ret`. A generator must pass through
 * unwrapped: calling one builds an iterator without running the body, moving no stack, which the
 * seam would read as an omitted ret and answer with `m.ret()` before the spine had begun.
 *
 * Mutation-checked, both arms: deleting the generator branch fails one test, wrapping nothing
 * fails two.
 *
 * Run: node --test games/timeplt/test/omitted-ret-seam.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { withOmittedRet } from "../machine.js";

/**
 * The narrowest stub the seam touches: the stack pointer it measures, the word it reads from the
 * seat to recognise a transfer-out, the pc it compares that against, and the ret it may fire.
 */
const CALLER_RET = 0x4c87;
function stub() {
  return {
    regs: { sp: 0xf000 },
    pc: 0x0000,
    mem: { read16: () => CALLER_RET },
    rets: 0,
    ret() {
      this.rets += 1;
      this.regs.sp += 2;
      this.pc = CALLER_RET;
    },
  };
}

test("an ordinary routine is wrapped, and the seam supplies the missing ret", () => {
  let ran = 0;
  const wrapped = withOmittedRet(() => {
    ran += 1;
  }, 0x1234);

  assert.notEqual(wrapped, undefined);
  const m = stub();
  wrapped(m);

  assert.equal(ran, 1, "the body must still run");
  assert.equal(m.rets, 1, "the seam owes exactly one ret to the translated caller");
});

test("a generator function passes through UNWRAPPED and fires no ret", () => {
  function* spine() {
    yield 1;
  }
  const seamed = withOmittedRet(spine, 0x0000);

  // Identity is the claim: not a wrapper that happens to behave, the function itself.
  assert.equal(seamed, spine, "a spine generator must not be wrapped at all");

  // And the reason it matters: building the iterator moves no stack, so a wrapper here would
  // read zero movement as an omitted ret. Drive it to show no ret is fired.
  const m = stub();
  const it = seamed(m);
  assert.equal(m.rets, 0, "constructing the coroutine must not fire a ret");
  assert.equal(it.next().value, 1, "the generator must still be a working iterator");
  assert.equal(m.rets, 0, "advancing the coroutine must not fire a ret either");
});

test("TEETH: the two arms disagree, so a seam that wrapped everything would fail", () => {
  // The positive control for the test above. An ordinary function with a generator's SHAPE of
  // effect -- it runs, moves no stack -- IS wrapped and does get a ret. So "no ret fired" in the
  // generator case is a property of the generator branch and not of doing nothing.
  const lookalike = withOmittedRet((m) => {
    void m;
  }, 0x5678);
  const m = stub();
  lookalike(m);
  assert.equal(m.rets, 1, "a non-generator that moves no stack still gets the seam's ret");
});
