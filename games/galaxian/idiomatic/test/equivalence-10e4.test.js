// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_10e4 — crafted-entry equivalence vs the frozen object sub-state dispatcher at ROM 0x10e4.
 * Register live-in is IX (the object-record base); the ROM reads its sub-state field (ix+0x02) and, through
 * the inline rst-28 table, tail-dispatches to one of four per-phase animation handlers. The idiomatic form
 * absorbs the dispatch into a JS switch that calls the handler directly, so no guest-stack word is pushed.
 * We point IX at a scratch record and craft each sub-state:
 *   index 0 -> arm: seeds the animation timers, advances the sub-state, posts the position-keyed sound req.
 *   index 1 -> tick: fast field counts down (here just ticks, > 1).
 *   index 2 -> expiry: the countdown reaches zero, clearing the state byte.
 *   index 3 -> no-op terminal slot: nothing changes.
 * Every live-out is a record field or a global, so RAM equivalence is the whole story: EQUAL asserts
 * ramDiff==null on each arm with a non-vacuous positive control. Teeth: a no-op twin and two mis-dispatch
 * twins (routing the wrong index) each diverge, proving the selector is load-bearing. The SP-seam tooth
 * proves the stack-neutral tail dispatch places at the seam on two arms and refuses a stack-adrift mutant.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_10e4 as cand } from "../loc_10e4.js";
import { loc_10e4 as oracle } from "../../translated/loc_10e4.js";
import { armObjectAnimAndRequestSound } from "../armObjectAnimAndRequestSound.js";
import { tickDeactivatedObjectAnim } from "../tickDeactivatedObjectAnim.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = 0x4280; // scratch record in work RAM, clear of the masked stack window at 0x43e0+
const SOUND_REQ = 0x41df; // position-keyed sound-request cell the arm handler writes
const SUBSTATE = 0x02, FAST = 0x10, SLOW = 0x11, COMPANION = 0x12, STATE = 0x01, POS = 0x07;

function seed(mut) {
  return craft((mem8, m) => {
    m.push16(0x9999); // seat a caller-return word: the tail dispatch's handler rets to loc_10e4's caller
    m.regs.ix = OBJ;
    mem8[OBJ + SUBSTATE] = 0;
    mem8[OBJ + FAST] = 0; mem8[OBJ + SLOW] = 0; mem8[OBJ + COMPANION] = 0;
    mem8[OBJ + STATE] = 0x77; mem8[OBJ + POS] = 0;
    mem8[SOUND_REQ] = 0; // cleared so the arm handler's write is observable
    if (mut) mut(mem8, m);
  });
}

const index0 = () => seed((mem) => { mem[OBJ + SUBSTATE] = 0; });                      // arm
const index1 = () => seed((mem) => { mem[OBJ + SUBSTATE] = 1; mem[OBJ + FAST] = 3; }); // tick, still counting
const index2 = () => seed((mem) => { mem[OBJ + SUBSTATE] = 2; mem[OBJ + FAST] = 1; }); // expiry -> clear state
const index3 = () => seed((mem) => { mem[OBJ + SUBSTATE] = 3; });                      // no-op slot

function runOracle(entry) { const a = entry.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_10e4 == oracle on every dispatch arm", { skip }, () => {
  for (const [name, mk] of [
    ["index0-arm", index0], ["index1-tick", index1], ["index2-expiry", index2], ["index3-noop", index3],
  ]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `loc_10e4 diverged on ${name}`);
  }

  // Positive controls: the oracle performs the arm-specific mutation (so the ramDiff match is non-vacuous).
  const a0 = runOracle(index0());
  assert.equal(a0.mem8[OBJ + FAST], 4, "index0: arm seeds fast field to 4");
  assert.equal(a0.mem8[OBJ + SLOW], 4, "index0: arm seeds slow field to 4");
  assert.equal(a0.mem8[OBJ + COMPANION], 0x1c, "index0: arm seeds companion field to 28");
  assert.equal(a0.mem8[OBJ + SUBSTATE], 1, "index0: arm advances the sub-state 0->1");
  assert.equal(a0.mem8[SOUND_REQ], 0x07, "index0: pos below threshold -> low sound request");

  assert.equal(runOracle(index1()).mem8[OBJ + FAST], 2, "index1: fast field ticks 3->2");

  const a2 = runOracle(index2());
  assert.equal(a2.mem8[OBJ + FAST], 0, "index2: countdown reaches zero");
  assert.equal(a2.mem8[OBJ + STATE], 0, "index2: expiry clears the state byte");

  const a3 = runOracle(index3());
  assert.equal(a3.mem8[OBJ + SUBSTATE], 3, "index3: no-op slot leaves the sub-state untouched");
  assert.equal(a3.mem8[OBJ + FAST], 0, "index3: no-op slot touches no timer");
  assert.equal(a3.mem8[OBJ + STATE], 0x77, "index3: no-op slot touches no state byte");

  console.log("  EQUAL: loc_10e4 == oracle on all four dispatch arms");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Mis-dispatch twins: route the wrong index. Each must diverge from the correct arm.
  const armWhenTick = (m) => tickDeactivatedObjectAnim(m, m.regs.ix); // arm state but run the tick handler
  const noopWhenArm = (m) => armObjectAnimAndRequestSound(m, m.regs.ix); // no-op state but run the arm handler

  assert.ok(ramDiff(oracle, noOp, index0()), "the no-op twin escaped (index0)");
  assert.ok(ramDiff(oracle, armWhenTick, index0()), "the mis-dispatch twin escaped (tick handler on index0)");
  assert.ok(ramDiff(oracle, noopWhenArm, index3()), "the mis-dispatch twin escaped (arm handler on index3)");
  console.log("  TEETH: no-op and both mis-dispatch twins caught");
});

test("SP-SEAM TOOTH: the tail dispatch places at the dispatch seam", { skip }, () => {
  const r0 = seamPlaceable(withOmittedRet, cand, 0x10e4, index0());
  assert.equal(r0.placeable, true, `seam refused the stack-neutral body on index0: ${r0.error}`);
  const r1 = seamPlaceable(withOmittedRet, cand, 0x10e4, index1());
  assert.equal(r1.placeable, true, `seam refused the stack-neutral body on index1: ${r1.error}`);

  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x10e4, index0());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");

  console.log("  SP-SEAM: stack-neutral tail dispatch places on two arms; stack-adrift mutant refused");
});
