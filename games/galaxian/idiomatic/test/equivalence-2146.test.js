// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2146 — memory-equivalent to the frozen oracle at ROM 0x2146.
 * Looks up a 2x2 tile-block base code in the block table by register A, then stamps that block at the
 * VRAM pointer arriving in DE. Live-out is the block's VRAM writes (in the state dump). Seed A=index and
 * DE=destination; assert ramDiff==null (return-stack masked). Positive control: the oracle stamps the
 * looked-up tile at the destination. Teeth: no-op, wrong-index (wrong tile) and wrong-destination twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { drawIndexedTileBlock as cand } from "../drawIndexedTileBlock.js";
import { loc_2146 as oracle } from "../../translated/loc_2146.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const INDEX = 1;         // block-table entry 1 -> base tile 0x38
const DEST = 0x5140;     // VRAM draw destination (arrives in DE)
const FIRST_TILE = 0x38; // table[1]; stamped at DEST

// Seed A=index, DE=destination, a sentinel at the first target cell, and the oracle's ret target.
const entry = () => craft((mem8, mm) => {
  mm.push16(0x9999);
  mm.regs.a = INDEX;
  mm.regs.de = DEST;
  mem8[DEST] = 0xee;
});

test("EQUAL (crafted): loc_2146 == oracle stamps the looked-up 2x2 block", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_2146 diverged on the block stamp");
  const a = entry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DEST], FIRST_TILE, "positive control: oracle stamped the looked-up tile at the destination");
  console.log("  EQUAL: loc_2146 == oracle, 2x2 block stamped from the table lookup");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongIndex = (m) => { m.regs.a = INDEX + 1; cand(m); };
  const wrongDest = (m) => { m.regs.de = DEST + 0x40; cand(m); };
  assert.ok(ramDiff(oracle, noOp, entry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongIndex, entry()), "wrong-index twin escaped");
  assert.ok(ramDiff(oracle, wrongDest, entry()), "wrong-destination twin escaped");
  console.log("  TEETH: no-op, wrong-index, wrong-destination all caught");
});
