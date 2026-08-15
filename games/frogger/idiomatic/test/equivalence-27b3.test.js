// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_27b3 — memory-equivalent to the frozen oracle at ROM 0x27B3.
 * GATE: crafted-entry. Attract never dispatches this collision-flag reset within ENTRY_FRAMES
 * (probe: 0), so a coherent state is harvested at the neighbour 0x230f and the guard cell (0x8135)
 * is poked to reach both paths: zero -> immediate return, non-zero -> clear (0x8134) and fall through
 * to 0x27bc (which zeroes 0x8040-0x8043 and 0x8135). The fall-through callee runs on each side's own
 * clone, so its writes are part of the compared live-out. No register live-in; live-out memory-only,
 * so registers/SP are not compared; no push, so no stack mask. Teeth: three broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_27b3 } from "../loc_27b3.js";
import { loc_27b3 as oracle } from "../../translated/loc_27b3.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const HARVEST = 0x230f;
const LATCH = 0x8135;   // collision-latched guard
const SUBFLAG = 0x8134; // zeroed on the reset path
const CLEAR_TAIL = 0x27bc;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let base = null;
function seed() {
  if (base) return base;
  const real = TRANSLATED.get(HARVEST);
  const m = makeMachine(new Map([[HARVEST, (mm) => { if (!base) base = mm.clone(); return real(mm); }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  assert.ok(base, "vacuous: the neighbour was never dispatched");
  return base;
}
function poked(kv) {
  const e = seed().clone();
  for (const [a, v] of Object.entries(kv)) e.mem8[Number(a)] = v;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// A latched entry with marker bytes on the touched cells so the clears are observable.
function reset() { return poked({ [LATCH]: 1, [SUBFLAG]: 0x99, 0x8040: 0x11, 0x8041: 0x22, 0x8042: 0x33, 0x8043: 0x44 }); }
function noReset() { return poked({ [LATCH]: 0 }); }

function brokenNoOp() {}
function brokenNoClear(m) { const { mem8 } = m; if (mem8[LATCH] === 0) return; mem8[SUBFLAG] = 0; /* BUG: never calls 0x27bc */ }
function brokenWrongValue(m) { const { mem8 } = m; if (mem8[LATCH] === 0) return; mem8[SUBFLAG] = 1; return m.call(CLEAR_TAIL); /* BUG: 0x8134=1 */ }

test("EQUAL (crafted): loc_27b3 == oracle on both guard paths", { skip }, () => {
  assert.equal(ramDiff(loc_27b3, noReset()), null, "the ret path diverged");
  assert.equal(ramDiff(loc_27b3, reset()), null, "the reset path diverged");
  // non-vacuous: the reset path actually mutates RAM.
  assert.ok(ramDiff(brokenNoOp, reset()), "vacuous: oracle wrote nothing on the reset path");
  console.log("  EQUAL: ret path + reset path, loc_27b3 == oracle");
});

test("TEETH: broken twins are caught on the reset path", { skip }, () => {
  const e = reset();
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenNoClear, e), "the no-clear twin escaped");
  assert.ok(ramDiff(brokenWrongValue, e), "the wrong-value twin escaped");
  console.log("  TEETH: no-op, no-clear, wrong-value all caught");
});
