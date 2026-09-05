// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_08f2 — equivalent to the frozen oracle at ROM 0x08f2. The ROM's push/pop-hl pair (saved on entry,
 * restored at the shared epilogue) collapses to saving and restoring the pointer in place, so the body
 * moves NO stack and the head-commit is inlined (no pop epilogue is invoked). Live-outs: the queue slot writes +
 * committed write-head at 0x40a0 (all in the state dump) AND the caller's preserved pointer HL (the
 * ROM saves it on entry and restores it at the epilogue — invisible to the memory diff). So EQUAL
 * asserts ramDiff==null AND register HL on three paths:
 *   - FREE: head slot bit 7 set -> store D:E, advance the head two, commit it.
 *   - OCCUPIED: bit 7 clear -> leave the queue untouched.
 *   - BELOW FLOOR: advanced head under the floor -> clamped up to the floor before commit.
 * Teeth: a no-op and wrong-head twin (RAM), a wrong-HL twin that forgets to restore the pointer, and an
 * SP-seam tooth — the stack-neutral body places at the dispatch seam, a popping mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_08f2 as cand } from "../loc_08f2.js";
import { loc_08f2 as oracle } from "../../translated/loc_08f2.js";
import { loc_090b } from "../loc_090b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const HEAD = 0x40a0;     // write-head index
const SLOT_HI = 0x40c0;  // slot addressed when head == 0xc0
const SAVED = 0xdead;    // foreign HL, must be restored by the epilogue

// Free slot at head 0xc0; enqueue D:E = 0x06:0x04.
const freeEntry = () => craft((mem, mm) => {
  mm.regs.de = 0x0604; mm.regs.hl = SAVED;
  mem[HEAD] = 0xc0; mem[SLOT_HI] = 0x80;
  mm.push16(0x9999);
});
// Occupied slot (bit 7 clear): the queue is left alone.
const occupiedEntry = () => craft((mem, mm) => {
  mm.regs.de = 0x0604; mm.regs.hl = SAVED;
  mem[HEAD] = 0xc0; mem[SLOT_HI] = 0x00;
  mm.push16(0x9999);
});
// Head far below the floor: after the advance it must clamp up to the floor.
const belowFloor = () => craft((mem, mm) => {
  mm.regs.de = 0x0503; mm.regs.hl = SAVED;
  mem[HEAD] = 0x10; mem[0x4010] = 0x80;
  mm.push16(0x9999);
});

// HL is a register live-out; observe it directly (ramDiff is blind to registers).
function hlDiff(twin, e) {
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  return a.regs.hl === b.regs.hl ? null : `HL: 0x${a.regs.hl.toString(16)} vs 0x${b.regs.hl.toString(16)}`;
}

test("EQUAL (crafted): loc_08f2 == oracle on the queue and register HL", { skip }, () => {
  for (const [name, e] of [["free", freeEntry], ["occupied", occupiedEntry], ["below-floor", belowFloor]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `${name} path diverged on RAM`);
    assert.equal(hlDiff(cand, e()), null, `${name} path restored a different HL`);
  }
  // Non-vacuous: the free path stores the entry, advances+commits the head, and restores HL.
  const a = freeEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SLOT_HI], 0x06, "positive control: entry hi not stored");
  assert.equal(a.mem8[SLOT_HI + 1], 0x04, "positive control: entry lo not stored");
  assert.equal(a.mem8[HEAD], 0xc2, "positive control: write-head not advanced/committed");
  assert.equal(a.regs.hl, SAVED, "positive control: HL not restored");
  // Non-vacuous: the below-floor path clamps the committed head up to the floor.
  const b = belowFloor(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[HEAD], 0xc0, "positive control: head not clamped to the floor");
  console.log("  EQUAL: loc_08f2 == oracle — queue committed, HL preserved, floor clamp");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongHead = (m) => { cand(m); m.mem8[HEAD] = 0xc4; };   // right entry, wrong committed head
  const wrongHL = (m) => { cand(m); m.regs.hl = 0; };           // right RAM, forgets the HL restore
  assert.ok(ramDiff(oracle, noOp, freeEntry()), "the no-op twin escaped (RAM)");
  assert.ok(ramDiff(oracle, wrongHead, freeEntry()), "the wrong-head twin escaped (RAM)");
  assert.ok(hlDiff(wrongHL, freeEntry()), "the wrong-HL twin escaped (register)");
  console.log("  TEETH: no-op, wrong-head (RAM), wrong-HL (register) all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  // The ROM push/pop pair collapses to saving+restoring HL in place, so the body must move NO stack and
  // the seam completes the ret (moved 0). A body that re-invoked a pop epilogue would strand the caller's
  // return slot (moved +2 with pc off the slot) and the seam would refuse it — invisible to ramDiff/hlDiff.
  for (const [name, e] of [["free", freeEntry], ["occupied", occupiedEntry]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x08f2, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  // Null-mutant: a body that invokes the pop epilogue (the pre-fix bug) moves SP +2 with pc off the
  // caller slot, so the seam MUST refuse it — proving the tooth has teeth.
  const popping = (m, entry = m.regs.de, savedPtr = m.regs.hl) => { loc_090b(m); return (m.regs.hl = savedPtr); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x08f2, freeEntry());
  assert.equal(rm.placeable, false, "the popping mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places; popping mutant refused");
});
