// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_215f — memory-equivalent to the frozen oracle at ROM 0x215f. Picks one of three indicator forms by
 * the selector in A; whole contract is VRAM (in the state dump), so EQUAL asserts ramDiff==null on each:
 *   - form 0 -> blank the 4x4 block and overlay the 2x2 icon.
 *   - form 1 -> blank the 4x4 block only.
 *   - form >= 2 -> fold the selector into a tile code and stamp four 2x2 blocks, the seed advancing four
 *     codes per block (this cross-block advance is the load-bearing register thread through the delegate).
 * Teeth: no-op on each path, and a flat-tile twin that reuses one tile code for all four blocks (catches a
 * broken cross-block thread), plus a scribble.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { draw4x4TileForm as cand } from "../draw4x4TileForm.js";
import { loc_215f as oracle } from "../../translated/loc_215f.js";
import { drawTileBlock2x2 } from "../drawTileBlock2x2.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const BLOCK0 = 0x51da, BLOCK1 = 0x51dc, BLOCK2 = 0x521a, BLOCK3 = 0x521c;
const ICON = 0x51fc;
const BLANK = 0x40;
const SCRATCH = 0x4300; // a plain work-RAM cell for the ramDiff-teeth twin

const form = (sel) => craft((mem, mm) => { mm.push16(0x9999); mm.regs.a = sel; });

test("EQUAL (crafted): loc_215f == oracle blanks + overlays the icon on form 0", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, form(0)), null, "loc_215f diverged on form 0");
  const a = form(0); oracle(a);
  assert.equal(a.mem8[BLOCK0], BLANK, "positive control: form 0 did not blank the block");
  assert.equal(a.mem8[ICON], 96, "positive control: form 0 did not overlay the icon (tile 96)");
  console.log("  EQUAL: loc_215f == oracle (VRAM), form 0 blank + icon");
});

test("EQUAL (crafted): loc_215f == oracle blanks only on form 1", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, form(1)), null, "loc_215f diverged on form 1");
  const a = form(1); oracle(a);
  assert.equal(a.mem8[BLOCK0], BLANK, "positive control: form 1 did not blank the block");
  assert.equal(a.mem8[ICON], BLANK, "positive control: form 1 left an icon (should be blank)");
  console.log("  EQUAL: loc_215f == oracle (VRAM), form 1 blank only");
});

test("EQUAL (crafted): loc_215f == oracle stamps four advancing blocks on form 3", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, form(3)), null, "loc_215f diverged on form 3");
  const a = form(3); oracle(a);
  assert.equal(a.mem8[BLOCK0], 0xe0, "positive control: block 0 tile wrong");
  assert.equal(a.mem8[BLOCK1], 0xe4, "positive control: block 1 tile not advanced +4");
  assert.equal(a.mem8[BLOCK2], 0xe8, "positive control: block 2 tile not advanced +8");
  assert.equal(a.mem8[BLOCK3], 0xec, "positive control: block 3 tile not advanced +12");
  console.log("  EQUAL: loc_215f == oracle (VRAM), four blocks 0xe0/0xe4/0xe8/0xec");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Correct first tile for form 3, but reused for every block (no cross-block advance).
  const flatTile = (m) => {
    drawTileBlock2x2(m, 0xe0, BLOCK0);
    drawTileBlock2x2(m, 0xe0, BLOCK1);
    drawTileBlock2x2(m, 0xe0, BLOCK2);
    drawTileBlock2x2(m, 0xe0, BLOCK3);
  };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] = m.mem8[SCRATCH] ^ 0xff; };
  assert.ok(ramDiff(oracle, noOp, form(0)), "the no-op twin escaped (form 0)");
  assert.ok(ramDiff(oracle, noOp, form(1)), "the no-op twin escaped (form 1)");
  assert.ok(ramDiff(oracle, noOp, form(3)), "the no-op twin escaped (form 3)");
  assert.ok(ramDiff(oracle, flatTile, form(3)), "the flat-tile twin escaped (form 3)");
  assert.ok(ramDiff(oracle, scribble, form(3)), "the scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: no-op (0/1/3), flat-tile, scribble all caught");
});
