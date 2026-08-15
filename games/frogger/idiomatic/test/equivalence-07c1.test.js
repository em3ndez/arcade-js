// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_07c1 — memory-equivalent to the frozen oracle at ROM 0x07C1.
 * GATE: crafted-entry (probe: 0 within ENTRY_FRAMES). A coherent state is harvested at neighbour
 * 0x230f and the active-player cell (0x83fd) poked to reach both branches (delegate to 0x07ce vs the
 * direct raise); the 0x07ce callee runs on each side's clone so its writes join the compared live-out.
 * Memory-only live-out. Teeth: three twins, incl. a wrong-branch twin at the 0x826d==0 entry.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_07c1 } from "../loc_07c1.js";
import { loc_07c1 as oracle } from "../../translated/loc_07c1.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const HARVEST = 0x230f;
const ACTIVE = 0x83fd; // active player number (1 -> delegate to 0x07ce)
const GUARD = 0x826d;  // 0x07ce's guard: leaves the flag alone when 0
const FLAG = 0x825b;   // 2-player start flag
const DELEGATE = 0x07ce;
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
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// delegate path, guard set -> 0x07ce raises the flag (observable, non-vacuous)
function delegateRaise() { return poked({ [ACTIVE]: 1, [GUARD]: 5, [FLAG]: 0 }); }
// delegate path, guard clear -> 0x07ce leaves the flag; the branch choice is observable here
function delegateLeave() { return poked({ [ACTIVE]: 1, [GUARD]: 0, [FLAG]: 0 }); }
// direct path -> raise the flag without consulting the guard
function direct() { return poked({ [ACTIVE]: 2, [FLAG]: 0 }); }

function brokenNoOp() {}
function brokenNoSet(m) { const { mem8 } = m; if (mem8[ACTIVE] === 1) return m.call(DELEGATE); /* BUG: never sets the flag */ }
function brokenWrongBranch(m) { const { mem8 } = m; if (mem8[ACTIVE] === 1) { mem8[FLAG] = 1; return; } return m.call(DELEGATE); } // BUG: raises unconditionally on the delegate path

test("EQUAL (crafted): loc_07c1 == oracle on every branch", { skip }, () => {
  assert.equal(ramDiff(loc_07c1, delegateRaise()), null, "the delegate/raise path diverged");
  assert.equal(ramDiff(loc_07c1, delegateLeave()), null, "the delegate/leave path diverged");
  assert.equal(ramDiff(loc_07c1, direct()), null, "the direct path diverged");
  // non-vacuous: two paths actually raise the flag.
  assert.ok(ramDiff(brokenNoOp, delegateRaise()), "vacuous: oracle wrote nothing on delegate/raise");
  assert.ok(ramDiff(brokenNoOp, direct()), "vacuous: oracle wrote nothing on direct");
  console.log("  EQUAL: delegate/raise + delegate/leave + direct, loc_07c1 == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(brokenNoOp, direct()), "the no-op twin escaped");
  assert.ok(ramDiff(brokenNoSet, direct()), "the no-set twin escaped");
  // wrong-branch only diverges where the branches diverge: guard clear leaves the flag, B raises it.
  assert.ok(ramDiff(brokenWrongBranch, delegateLeave()), "the wrong-branch twin escaped");
  console.log("  TEETH: no-op, no-set, wrong-branch all caught");
});
