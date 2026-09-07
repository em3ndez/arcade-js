// SPDX-License-Identifier: GPL-3.0-only
// Regression pin for the object-grid walk's terminal ret. The walk (drawObjectFigureGridColumn ->
// routeObjectGridCellDraw -> drawAnimatedObjectGridCellAndAdvance / objectGridWalkLoopEpilogue) is entered
// TWO ways: the born-live push-free path forwards the loop state as savedHl/savedBc (no guest stack), while
// the isolated/oracle path leaves them undefined and pops hl/bc off a seeded stack, ending in a guest ret.
// The terminal must ret ONLY on the stack path -- popping in the push-free path leaks the never-pushed return
// address (+2 SP every drawn frame; MAME's own SP stays balanced, so it is a JS-layer leak, not the ROM).
// Each routine gets: (control) the stack path DOES move SP (so the pin is non-vacuous), (teeth) the born-live
// path leaves SP INERT.
import test from "node:test";
import assert from "node:assert/strict";
import { craft, romsPresent } from "./_bootSetup.js";
import { drawAnimatedObjectGridCellAndAdvance } from "../drawAnimatedObjectGridCellAndAdvance.js";
import { objectGridWalkLoopEpilogue } from "../objectGridWalkLoopEpilogue.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const STRIDE = 0x10;
const SLOT = 0x4130; // a work-RAM grid pointer; its flag byte selects the cell path (bit0)

// count=1 -> the walk terminates at the first row (remaining/count reaches 0 -> the terminal ret/return).
const BC1 = (1 << 8) | STRIDE;

test("object-grid walk: born-live (push-free) entry leaves SP inert; stack entry moves it", { skip }, () => {
  for (const [name, fn] of [
    ["drawAnimatedObjectGridCellAndAdvance", drawAnimatedObjectGridCellAndAdvance],
    ["objectGridWalkLoopEpilogue", objectGridWalkLoopEpilogue],
  ]) {
    // CONTROL: stack entry (savedHl/savedBc undefined) pops hl, bc, and the caller return -> SP climbs by 6.
    // Proves the routine manipulates SP at all, so the inert assertion below is not vacuous.
    const s = craft((mem8, e) => {
      e.regs.a = SLOT & 0xff;
      mem8[SLOT] = 0x00;           // inactive cell (epilogue path); drawAnimated ignores this at entry
      e.push16(0x9999);            // caller return (deepest)
      e.push16(BC1);               // BC saved
      e.push16(SLOT);              // HL saved (first pop)
    });
    const spStack0 = s.regs.sp;
    fn(s);                         // no savedHl/savedBc -> the stack path
    assert.equal(s.regs.sp, (spStack0 + 6) & 0xffff,
      `${name}: stack entry did not pop hl/bc/ret (SP 0x${spStack0.toString(16)} -> 0x${s.regs.sp.toString(16)})`);

    // TEETH: born-live entry forwards savedHl/savedBc -> no pop, no terminal guest ret -> SP unchanged.
    // (Before the fix the terminal was an unconditional m.ret(), so this SP would climb by 2.)
    const b = craft((mem8, e) => { e.regs.a = SLOT & 0xff; mem8[SLOT] = 0x00; });
    const spBorn0 = b.regs.sp;
    fn(b, SLOT, BC1);              // savedHl=SLOT, savedBc=BC1 -> the push-free path
    assert.equal(b.regs.sp, spBorn0,
      `${name}: born-live push-free entry moved SP (0x${spBorn0.toString(16)} -> 0x${b.regs.sp.toString(16)}) -- a stack leak`);
  }
});
