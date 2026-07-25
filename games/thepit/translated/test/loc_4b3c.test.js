// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_4b3c (ROM 0x4b3c, The Pit).
 *
 * loc_4b3c is two instructions: `ld a,0xc0` then an UNCONDITIONAL `jr 0x4b46`
 * into the shared control-latch setup loc_4b46. It is modelled as a tail-jump
 * (`return m.call(0x4b46)`, whose callee ret returns to OUR caller), so the test
 * uses a leaf-machine double whose `call` records the target WITHOUT invoking a
 * real routine -- "control transferred to 0x4b46 and never came back". loc_4b3c
 * touches no memory, so the double carries no mem.
 *
 * Asserts: the exact T-state total (7 + 12 = 19), A = 0xC0 (the load happened and
 * nothing reloaded it), the flags untouched (ld/jr touch no flags), the step
 * boundaries, and that control leaves via a tail-jump to 0x4b46 with NO ret. The
 * MUTATION corrupts the jr target to 0x4b44 (the A=0x00 entry of the same fan-in)
 * -- a plausible off-by-two offset slip -- with cycles UNCHANGED, proving the
 * call/step-target assertion (not the cycle count) is what rejects it.
 *
 * Run: node --test games/thepit/translated/test/loc_4b3c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4b3c } from "../loc_4b3c.js";

// Leaf-machine double: exactly the surface loc_4b3c touches (regs, step, call).
// step records target + charges cycles; call records the tail-jump target without
// invoking a real routine (loc_4b46 is a separate unit); ret would flip `returned`
// -- it must stay false, since a tail-jump never rets here.
function makeMachine() {
  const regs = new Regs();
  return {
    regs,
    cycles: 0,
    pc: 0x4b3c,
    steps: [],
    calls: [],
    returned: false,
    step(nextAddr, c) {
      this.pc = nextAddr;
      this.cycles += c;
      this.steps.push(nextAddr);
    },
    ret(c = 10) {
      this.cycles += c;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller; nothing to do here
    },
  };
}

const GOLDEN = {
  steps: [0x4b3e, 0x4b46],
  calls: [0x4b46],
  returned: false,
  cycles: 7 + 12, // ld a,n (7) + unconditional jr (12) = 19
  pc: 0x4b46,
  a: 0xc0,
};

function assertGolden(m, fBefore) {
  assert.deepEqual(m.steps, GOLDEN.steps, "step targets");
  assert.deepEqual(m.calls, GOLDEN.calls, "tail-jump target");
  assert.equal(m.returned, GOLDEN.returned, "no ret -- control tail-jumped away");
  assert.equal(m.cycles, GOLDEN.cycles, "T-state total (7 + 12)");
  assert.equal(m.pc, GOLDEN.pc, "final PC at the tail-jump target");
  assert.equal(m.regs.a, GOLDEN.a, "A = 0xC0 (loaded, not reloaded)");
  assert.equal(m.regs.f, fBefore, "flags untouched by ld/jr");
}

test("loc_4b3c: loads A=0xC0 and tail-jumps to loc_4b46, 19 T", () => {
  const m = makeMachine();
  m.regs.a = 0x55; // poison: a golden 0xC0 can only come from the `ld a,0xc0`
  m.regs.f = 0x2d; // arbitrary caller flags -- must survive unchanged
  loc_4b3c(m);
  assertGolden(m, 0x2d);
});

// -- MUTATION: the tail-jump target must have teeth ------------------------------
// Corrupt the jr target 0x4b46 -> 0x4b44 (the A=0x00 door of the same fan-in): a
// plausible off-by-two from mis-reading the 0x06 offset byte as 0x04. Cycles are
// IDENTICAL (jr is 12T either way), so only the call/step-target assertion can
// catch it.
test("loc_4b3c MUTATION: jr target 0x4b46 -> 0x4b44 is caught", () => {
  function loc_4b3c_mutant(m) {
    const { regs } = m;
    regs.a = 0xc0;
    m.step(0x4b3e, 7);
    m.step(0x4b44, 12); // BUG: should be 0x4b46
    return m.call(0x4b44); // BUG: should be 0x4b46
  }
  const m = makeMachine();
  m.regs.f = 0x2d;
  loc_4b3c_mutant(m);
  assert.equal(m.cycles, GOLDEN.cycles, "mutation preserves the cycle total (cycles cannot catch it)");
  assert.throws(() => assertGolden(m, 0x2d), /step targets|tail-jump target/);
});
