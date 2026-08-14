// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23eb — memory + A equivalent to the frozen oracle at ROM 0x23EB.
 * GATE: crafted-entry. Attract never dispatches this home-bay slot cursor (probe: 0 dispatches
 * over ENTRY_FRAMES; its callers are in-play home-bay handlers attract does not reach), so a post-boot
 * attract machine is cloned and the counter cell (0x8123) is poked across the wrap edge. LIVE-OUT is
 * memory + register A: two callers reload A but a third reaches this on a tail path that returns the
 * counter in A, so A is compared as well as RAM. The routine pushes nothing, so no stack window is
 * excluded. Teeth: three twins — no-op, wrong wrap threshold, and a register-arm twin that leaves
 * correct RAM but the wrong A (which a RAM-only diff is blind to, proving the A arm is load-bearing).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_23eb } from "../loc_23eb.js";
import { loc_23eb as oracle } from "../../translated/loc_23eb.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const COUNTER = 0x8123;
const PHASE_COUNT = 6;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with the counter cell forced to `v`.
function craft(v) {
  const e = seedMachine().clone();
  e.mem8[COUNTER] = v;
  return e;
}

// null == equivalent on the declared live-out: RAM plus register A.
function unitDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (d) return `RAM 0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}`;
  if (a.regs.a !== b.regs.a) return `A ${a.regs.a} vs ${b.regs.a}`;
  return null;
}
// RAM-only view, used to prove the register-arm twin is invisible to memory alone.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const CASES = [0, 1, 4, 5, PHASE_COUNT, 7, 255]; // below wrap, the reach-wrap edge (5), at/over wrap, full byte

// broken twins.
function brokenNoOp() {}
function brokenWrongWrap(m) { // wraps at 5 instead of 6
  const { regs, mem8 } = m;
  const n = (mem8[COUNTER] + 1) & 0xff;
  const p = n < 5 ? n : 0;
  mem8[COUNTER] = p; regs.a = p;
}
function brokenWrongA(m) { loc_23eb(m); m.regs.a = (m.regs.a + 1) & 0xff; } // correct RAM, wrong A

test("EQUAL (crafted): loc_23eb == oracle on RAM + A across the wrap edge", { skip }, () => {
  assert.ok(CASES.length > 0, "vacuous: no crafted entries");
  for (const v of CASES) {
    assert.equal(unitDiff(loc_23eb, craft(v)), null, `diverged at counter=${v}`);
    const chk = craft(v).clone(); oracle(chk);
    const expected = ((v + 1) & 0xff) < PHASE_COUNT ? ((v + 1) & 0xff) : 0;
    assert.equal(chk.mem8[COUNTER], expected, `oracle memory mismatch at ${v}`);
    assert.equal(chk.regs.a, expected, `oracle A mismatch at ${v}`); // pin the encoding
  }
  assert.ok(ramDiff(brokenNoOp, craft(3)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${CASES.length} crafted counter values, loc_23eb == oracle (RAM + A)`);
});

test("TEETH: broken twins are caught across memory and the A arm", { skip }, () => {
  const eKeep = craft(4); // counter+1 = 5: oracle keeps 5, a wrap-at-5 twin drops it to 0
  assert.ok(unitDiff(brokenNoOp, craft(3)), "the no-op twin escaped");
  assert.ok(unitDiff(brokenWrongWrap, eKeep), "the wrong-wrap twin escaped");
  assert.ok(unitDiff(brokenWrongA, craft(3)), "the wrong-A twin escaped");
  assert.equal(ramDiff(brokenWrongA, craft(3)), null, "wrong-A must be invisible to a RAM-only diff");
  console.log("  TEETH: no-op, wrong-wrap, wrong-A (register arm) all caught; A arm proven load-bearing");
});
