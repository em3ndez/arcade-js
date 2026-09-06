// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1d28 — crafted-entry equivalence vs the frozen tile-strip fill head at ROM 0x1d28. Pets the
 * watchdog, then branches on the gate byte 0x4008:
 *   FILL (gate != 0): load the VRAM write cursor from 0x400b and draw the strip — 16 tile pairs 0x30/0x32
 *     then 16 pairs 0x34/0x36 forward from the cursor, save the advanced cursor to 0x400b, and tick the
 *     strip countdown 0x4008.
 *   DWELL (gate == 0): no strip; tick the outer screen-fill dwell tier 0x4009 instead.
 * The watchdog read has no work-RAM effect, so both branches are memory-only and EQUAL asserts
 * ramDiff==null. Teeth prove the fill, the tick, and the branch selection are load-bearing; an SP-seam
 * tooth covers the tail dispatch.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_1d28 as cand } from "../loc_1d28.js";
import { loc_1d28 as oracle } from "../../translated/loc_1d28.js";
import { restartScreenFillOnDwellExpiry } from "../restartScreenFillOnDwellExpiry.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const GATE = 0x4008;
const TIER = 0x4009;
const CURSOR_PTR = 0x400b;
const VRAM = 0x5000;

const fill = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] = 5; // nonzero -> draw the strip
  mem[CURSOR_PTR] = 0x00; mem[CURSOR_PTR + 1] = 0x50; // cursor = 0x5000
  for (let i = 0; i < 64; i++) mem[VRAM + i] = 0xee; // dirty so the fill is observable
});

const dwell = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[GATE] = 0; // zero -> no strip, tick the outer dwell
  mem[TIER] = 3; // counts down (3 -> 2), no reseed
});

function runOracle(e) { const a = e.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_1d28 == oracle draws the tile strip when the gate is set", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, fill()), null, "loc_1d28 diverged on the fill path");
  const a = runOracle(fill());
  assert.equal(a.mem8[VRAM], 0x30, "positive control: first-half tile A");
  assert.equal(a.mem8[VRAM + 1], 0x32, "positive control: first-half tile B");
  assert.equal(a.mem8[VRAM + 31], 0x32, "positive control: first-half tail");
  assert.equal(a.mem8[VRAM + 32], 0x34, "positive control: second-half tile A");
  assert.equal(a.mem8[VRAM + 33], 0x36, "positive control: second-half tile B");
  assert.equal(a.mem8[VRAM + 63], 0x36, "positive control: second-half tail");
  assert.equal(a.mem8[CURSOR_PTR], 0x40, "positive control: advanced cursor low (0x5040)");
  assert.equal(a.mem8[CURSOR_PTR + 1], 0x50, "positive control: advanced cursor high");
  assert.equal(a.mem8[GATE], 4, "positive control: strip countdown ticked (5->4)");
  console.log("  EQUAL: loc_1d28 == oracle (fill) — 64 VRAM cells stamped, cursor advanced, countdown ticked");
});

test("EQUAL (crafted): loc_1d28 == oracle ticks the outer dwell when the gate is clear", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, dwell()), null, "loc_1d28 diverged on the dwell path");
  const a = runOracle(dwell());
  assert.equal(a.mem8[TIER], 2, "positive control: dwell tier ticked (3->2)");
  assert.equal(a.mem8[GATE], 0, "positive control: gate left clear, no strip drawn");
  console.log("  EQUAL: loc_1d28 == oracle (dwell) — outer dwell tier ticked, no strip");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongTile = (m) => { cand(m); m.mem8[VRAM] ^= 0xff; };
  const wrongBranch = (m) => restartScreenFillOnDwellExpiry(m, GATE); // takes the dwell branch on a fill entry
  const noTick = (m) => { cand(m); m.mem8[GATE] = 5; }; // undo the countdown tick

  assert.ok(ramDiff(oracle, noOp, fill()), "the no-op twin escaped (fill)");
  assert.ok(ramDiff(oracle, wrongTile, fill()), "the wrong-tile twin escaped");
  assert.ok(ramDiff(oracle, wrongBranch, fill()), "the wrong-branch twin escaped (fill not load-bearing?)");
  assert.ok(ramDiff(oracle, noTick, fill()), "the no-tick twin escaped (countdown not load-bearing?)");
  assert.ok(ramDiff(oracle, noOp, dwell()), "the no-op twin escaped (dwell)");
  console.log("  TEETH: no-op, wrong-tile, wrong-branch, no-tick all caught");
});

test("SP-SEAM TOOTH: the tail dispatch places at the dispatch seam", { skip }, () => {
  const r = seamPlaceable(withOmittedRet, cand, 0x1d28, fill());
  assert.equal(r.placeable, true, `seam refused the stack-neutral body: ${r.error}`);
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x1d28, fill());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places; stack-adrift mutant refused");
});
