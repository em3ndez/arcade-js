// SPDX-License-Identifier: GPL-3.0-only
/**
 * routeObjectGridCellDraw — crafted-entry equivalence vs the frozen slot-walk iteration at ROM 0x207d.
 * routeObjectGridCellDraw makes no memory write of its own: it reads bit 0 of the slot flag byte (HL) and routes -- set to
 * the active-slot handler + epilogue (drawAnimatedObjectGridCellAndAdvance), clear to the fixed-tile draw (drawFixedTileFigureAtPackedCoord,
 * ROM 0x205e) then the epilogue (objectGridWalkLoopEpilogue) -- passing the slot's low byte as the packed coord (A = L) and
 * forwarding the loop state (HL = slot pointer, BC = count+stride) to the epilogue as JS-local params (the
 * idiomatic layer never pushes, so it hands the saved values across instead of the oracle's pushed pair).
 * Every observable write is VRAM stamped by a callee, so ramDiff carries the verdict. Entries: a one-slot
 * active walk, a one-slot inactive walk, and a two-slot walk (inactive then active) that exercises the loop
 * and the saved-state forwarding across the draw's register clobber. With the frame counter pinned to 0 the
 * active path's glyph (index-table code, != the fixed seed 0x2c) is distinct from the inactive path's fixed
 * pair, so the wrong-branch teeth bite deterministically. Teeth: no-op, always-active, always-inactive, wrong
 * coord, clobbered-state forwarding. An SP-seam tooth guards the seam placement (routeObjectGridCellDraw is reached via the
 * registry seam from the still-translated drawObjectFigureGridColumn). NOTE: this exercises the co-batch drawAnimatedObjectGridCellAndAdvance/objectGridWalkLoopEpilogue ABI
 * -- objectGridWalkLoopEpilogue must accept (m, savedHl, savedBc) like drawAnimatedObjectGridCellAndAdvance for a push-free routeObjectGridCellDraw to feed it the loop
 * state (see the module's blocker note).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { routeObjectGridCellDraw as cand } from "../routeObjectGridCellDraw.js";
import { loc_207d as oracle } from "../../translated/loc_207d.js";
import { drawAnimatedObjectGridCellAndAdvance } from "../drawAnimatedObjectGridCellAndAdvance.js";
import { objectGridWalkLoopEpilogue } from "../objectGridWalkLoopEpilogue.js";
import { drawFixedTileFigureAtPackedCoord } from "../drawFixedTileFigureAtPackedCoord.js";
import { mapPackedCoordToVram } from "../mapPackedCoordToVram.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SLOT0 = 0x4120;   // first slot flag byte (drawObjectFigureGridColumn seeds HL here); low byte = packed coord (0x20)
const STRIDE = 0x10;    // per-slot stride C
const COUNTER = 0x425f; // frame counter the active-path variant fold reads; pin it for determinism

// bit0 set -> the active-slot handler path (drawAnimatedObjectGridCellAndAdvance). One slot (B=1), then the epilogue returns.
const active = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.bc = 0x0100 | STRIDE; // B=1 (count), C=stride
  mm.regs.hl = SLOT0;
  mem[SLOT0] = 0x01;
  mem[COUNTER] = 0;
});

// bit0 clear -> the fixed-figure draw + epilogue path (objectGridWalkLoopEpilogue). One slot (B=1), then the epilogue returns.
const inactive = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.bc = 0x0100 | STRIDE;
  mm.regs.hl = SLOT0;
  mem[SLOT0] = 0x00;
  mem[COUNTER] = 0;
});

// Two slots: slot0 inactive (draw + objectGridWalkLoopEpilogue + loop back), slot1 active (drawAnimatedObjectGridCellAndAdvance). Exercises the loop and
// the saved-state forwarding across the draw's register clobber.
const multi = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.bc = 0x0200 | STRIDE; // B=2, C=stride
  mm.regs.hl = SLOT0;
  mem[SLOT0] = 0x00;
  mem[SLOT0 + STRIDE] = 0x01;
  mem[COUNTER] = 0;
});

// mapPackedCoordToVram is a pure coord->cell function; run it on a throwaway to learn where a coord draws.
function cellFor(coord) { return mapPackedCoordToVram(craft(), coord); }
function runOracle(e) { e.routines = STUBS; oracle(e); return e; }

test("EQUAL (crafted): routeObjectGridCellDraw == oracle on active / inactive / multi-slot (RAM)", { skip }, () => {
  for (const [name, e] of [["active", active()], ["inactive", inactive()], ["multi", multi()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `routeObjectGridCellDraw diverged on the ${name} entry`);
  }
  assert.ok(ramDiff(oracle, () => {}, active()), "vacuous: oracle changed no RAM on the active entry");
  console.log("  EQUAL: routeObjectGridCellDraw == oracle (RAM) on active, inactive, and multi-slot walks");
});

test("positive controls: each path writes an observable tile at the mapped cell", { skip }, () => {
  const cellIn = cellFor(SLOT0 & 0xff);

  const inSeed = inactive(); inSeed.mem8[cellIn] = 0xee;
  runOracle(inSeed);
  assert.notEqual(inSeed.mem8[cellIn], 0xee, "inactive path wrote no tile at the mapped cell");

  const acSeed = active(); acSeed.mem8[cellIn] = 0xee;
  runOracle(acSeed);
  assert.notEqual(acSeed.mem8[cellIn], 0xee, "active path wrote no tile at the mapped cell");
  console.log("  positive: active + inactive paths each paint the mapped cell (not a 0xff-hide)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};

  // ignores the flag bit and always takes the active-slot path
  const alwaysActive = (m) => {
    const hl = m.regs.hl, bc = m.regs.bc, coord = hl & 0xff;
    return (m.regs.a = coord, drawAnimatedObjectGridCellAndAdvance(m, hl, bc));
  };
  // ignores the flag bit and always takes the inactive draw + epilogue path
  const alwaysInactive = (m) => {
    const hl = m.regs.hl, bc = m.regs.bc, coord = hl & 0xff;
    drawFixedTileFigureAtPackedCoord(m, coord);
    return objectGridWalkLoopEpilogue(m, hl, bc);
  };
  // flips coord bit 4 -> a different mapped cell (and figure kind) for whichever branch is taken
  const wrongCoord = (m) => {
    const hl = m.regs.hl, bc = m.regs.bc, coord = (hl & 0xff) ^ 0x10;
    if (m.mem8[hl] & 1) return (m.regs.a = coord, drawAnimatedObjectGridCellAndAdvance(m, hl, bc));
    drawFixedTileFigureAtPackedCoord(m, coord);
    return objectGridWalkLoopEpilogue(m, hl, bc);
  };
  // forwards the draw-clobbered register bridge to the epilogue instead of the saved JS locals -> the next
  // iteration walks from a corrupted pointer (this is the bug the JS-local capture prevents)
  const clobberedState = (m) => {
    const hl = m.regs.hl, coord = hl & 0xff;
    if (m.mem8[hl] & 1) return (m.regs.a = coord, drawAnimatedObjectGridCellAndAdvance(m, hl, m.regs.bc));
    drawFixedTileFigureAtPackedCoord(m, coord);
    return objectGridWalkLoopEpilogue(m, m.regs.hl, m.regs.bc);
  };

  assert.ok(ramDiff(oracle, noOp, active()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, alwaysInactive, active()), "the always-inactive twin escaped (active entry)");
  assert.ok(ramDiff(oracle, alwaysActive, inactive()), "the always-active twin escaped (inactive entry)");
  assert.ok(ramDiff(oracle, wrongCoord, active()), "the wrong-coord twin escaped (active entry)");
  assert.ok(ramDiff(oracle, wrongCoord, inactive()), "the wrong-coord twin escaped (inactive entry)");
  assert.ok(ramDiff(oracle, clobberedState, multi()), "the clobbered-state twin escaped (multi-slot)");
  console.log("  TEETH: no-op, wrong-branch (x2), wrong-coord (x2), clobbered-state all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["active", active()], ["inactive", inactive()]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x207d, e);
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  // Null-mutant: drop a balancing push (an extra pop) so SP drifts up +2 past the legit +2 tail-dispatch to
  // +4 -- the missing-push16 class the seam must reject. (A stray PUSH of the caller-ret value would net back
  // to the accepted moved-0 omitted-ret state, which the seam legitimately heals -- no teeth for a +2 body.)
  const dropPush = (m) => { cand(m); m.pop16(); };
  const rm = seamPlaceable(withOmittedRet, dropPush, 0x207d, inactive());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on active + inactive; stack-adrift mutant refused");
});
