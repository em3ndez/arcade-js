// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0cd6 — crafted-entry equivalence vs the frozen per-slot object driver at ROM 0x0cd6.
 * Register live-in is IX (the object-record base). The ROM tests the record's death-anim bit (ix+1 bit0)
 * and, if set, tail-hands off to the dying-object dispatcher (0x10e4); else skips an inactive slot (ix+0
 * bit0 clear -> ret); else reads the state index (ix+2) and, through the inline rst-28 word table at
 * 0x0ce6-0x0d05, tail-dispatches to one of 16 object-AI handlers. The idiomatic form absorbs the rst-28
 * into a JS handler table, direct-calling each handler, so no guest-stack word is pushed.
 * We point IX at a clean scratch record and craft each path:
 *   inactive        -> ret, no work.
 *   death-anim 0..3 -> hand off to dispatchDeactivatedObjectAnim's four anim sub-state arms.
 *   state 0..15     -> the matching object-AI handler.
 * Every live-out is a record field or a global (callers read no register back: loc_0cc3 brackets the call
 * with exx and never reads A/HL, and IX is preserved), so RAM equivalence is the whole story: EQUAL asserts
 * ramDiff==null on every arm with non-vacuous positive controls (state 15 steps the X field; the death-anim
 * arm posts a sound request + seeds timers). Teeth: a no-op twin, an ignore-active-gate twin, an
 * ignore-death-anim twin, and a mis-dispatch twin each diverge, proving the two gates and the selector are
 * load-bearing. The SP-seam tooth proves the stack-neutral absorbed dispatch places at the seam on every
 * arm and refuses a stack-adrift mutant.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { driveObjectSlot as cand } from "../driveObjectSlot.js";
import { loc_0cd6 as oracle } from "../../translated/loc_0cd6.js";
import { settleObjectXAtRest } from "../settleObjectXAtRest.js";
import { initSpawnedObjectFromGridCell } from "../initSpawnedObjectFromGridCell.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = 0x4280; // scratch record in work RAM, clear of the masked stack window at 0x43e0+
const ACTIVE = 0x00, DEATH = 0x01, STATE = 0x02, XFIELD = 0x04, FDIV = 0x10; // record offsets
const SOUND_REQ = 0x41df; // position-keyed sound-request cell the death-anim arm handler writes

// A clean scratch record (active, no death-anim), with the arm-observable globals cleared.
function seed(mut) {
  return craft((mem8, m) => {
    m.push16(0x9999); // caller-return word for the oracle's tail dispatch / ret
    m.regs.ix = OBJ;
    for (let k = 0; k < 0x20; k++) mem8[OBJ + k] = 0; // 32-byte record base
    mem8[OBJ + ACTIVE] = 1;
    mem8[SOUND_REQ] = 0;
    if (mut) mut(mem8, m);
  });
}

const stateEntry = (i) => seed((mem) => { mem[OBJ + STATE] = i; });                    // active + state i
const inactive = () => seed((mem) => { mem[OBJ + ACTIVE] = 0; mem[OBJ + STATE] = 15; });// active bit clear
const deathAnim = (sub) => seed((mem) => { mem[OBJ + DEATH] = 1; mem[OBJ + STATE] = sub; });

function runOracle(entry) { const a = entry.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_0cd6 == oracle on every dispatch path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, inactive()), null, "inactive path diverged");
  for (const sub of [0, 1, 2, 3]) {
    assert.equal(ramDiff(oracle, cand, deathAnim(sub)), null, `death-anim sub-state ${sub} diverged`);
  }
  for (let i = 0; i < 16; i++) {
    assert.equal(ramDiff(oracle, cand, stateEntry(i)), null, `state index ${i} diverged`);
  }

  // Non-vacuous positive controls: the oracle mutates RAM on the arms the EQUAL comparison covers.
  assert.equal(runOracle(stateEntry(15)).mem8[OBJ + XFIELD], 1, "state 15: settle steps the X field 0->1");
  const d = runOracle(deathAnim(0));
  assert.equal(d.mem8[SOUND_REQ], 0x07, "death-anim sub-0: arm posts the low sound request");
  assert.equal(d.mem8[OBJ + FDIV], 4, "death-anim sub-0: arm seeds the frame divider to 4");
  assert.equal(d.mem8[OBJ + STATE], 1, "death-anim sub-0: arm advances the sub-state 0->1");
  console.log("  EQUAL: loc_0cd6 == oracle on inactive, death-anim (0..3), and all 16 state arms");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // No-op twin: a writing state must diverge (also proves the state-15 EQUAL arm is non-vacuous).
  assert.ok(ramDiff(oracle, noOp, stateEntry(15)), "the no-op twin escaped (state 15 writes)");
  // Ignore-active-gate twin: dispatching an INACTIVE slot writes where the driver should ret.
  const ignoreActiveGate = (m) => settleObjectXAtRest(m, m.regs.ix);
  assert.ok(ramDiff(oracle, ignoreActiveGate, inactive()), "the ignore-active-gate twin escaped");
  // Ignore-death-anim twin: running the state handler instead of handing off diverges.
  const ignoreDeathAnim = (m) => initSpawnedObjectFromGridCell(m, m.regs.ix);
  assert.ok(ramDiff(oracle, ignoreDeathAnim, deathAnim(0)), "the ignore-death-anim twin escaped");
  // Mis-dispatch twin: the wrong state handler (state-0 arm on a state-15 entry) diverges.
  const misdispatch = (m) => initSpawnedObjectFromGridCell(m, m.regs.ix);
  assert.ok(ramDiff(oracle, misdispatch, stateEntry(15)), "the mis-dispatch twin escaped");
  console.log("  TEETH: no-op, ignore-active-gate, ignore-death-anim, and mis-dispatch twins all caught");
});

test("SP-SEAM TOOTH: the absorbed dispatch places at the seam", { skip }, () => {
  for (const [name, mk] of [
    ["state15", () => stateEntry(15)], ["death-anim", () => deathAnim(0)], ["inactive", () => inactive()],
  ]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x0cd6, mk());
    assert.equal(r.placeable, true, `seam refused the stack-neutral body on ${name}: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x0cd6, stateEntry(15));
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral dispatch places on all arms; stack-adrift mutant refused");
});
