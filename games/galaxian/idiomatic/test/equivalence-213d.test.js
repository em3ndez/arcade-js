// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_213d — memory-equivalent to the frozen translated oracle at ROM 0x213d. Tests the sign of the
 * selector in B: non-negative (bit7 clear) -> look a 2x2 tile-block base up in the block table by B and
 * stamp it at the pending destination; negative (bit7 set) -> stamp a fixed fallback block (base 0xa4).
 * Live-out is the block's VRAM writes (in the state dump), so EQUAL is asserted with ramDiff==null on
 * both branches. Positive controls confirm the oracle stamps the looked-up tile (non-neg) and the
 * fallback tile (neg) at the destination. Teeth: no-op (both), a wrong-branch twin that runs the fallback
 * on the non-neg entry, a wrong-index twin, and a wrong-fallback-tile twin. Return-stack masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_213d as cand } from "../loc_213d.js";
import { loc_213d as oracle } from "../../translated/loc_213d.js";
import { drawIndexedTileBlock } from "../drawIndexedTileBlock.js";
import { drawTileBlock2x2AtDe } from "../drawTileBlock2x2AtDe.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const INDEX = 1;           // block-table entry 1 -> base tile 0x38
const FIRST_TILE = 0x38;   // table[1]; stamped at DEST on the non-negative branch
const FALLBACK_TILE = 0xa4;// base stamped on the negative branch
const DEST = 0x5140;       // VRAM draw destination (arrives in DE)
const SWAP = 0x51c0;        // arrives in HL; only lands in a register (memory-invisible)

// Non-negative selector: bit7 clear -> table lookup by B, stamped at DE.
const nonNegEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.b = INDEX;
  mm.regs.de = DEST;
  mem[DEST] = 0xee;
});
// Negative selector: bit7 set -> the fallback block, stamped at the pointer that arrived in DE.
const negEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.b = 0x80;
  mm.regs.de = DEST;
  mm.regs.hl = SWAP;
  mem[DEST] = 0xee;
});

const noOp = () => {};
const runFallback = (m) => drawTileBlock2x2AtDe(m, FALLBACK_TILE);       // wrong branch on the non-neg entry
const wrongIndex = (m) => drawIndexedTileBlock(m, m.regs.b + 1);         // right branch, wrong index
const wrongFallback = (m) => drawTileBlock2x2AtDe(m, FALLBACK_TILE + 1); // right branch, wrong fallback tile

test("EQUAL (crafted): loc_213d == oracle stamps the table-lookup block on a non-negative selector", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, nonNegEntry()), null, "loc_213d diverged on the non-negative branch");
  const a = nonNegEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DEST], FIRST_TILE, "positive control: oracle stamped the looked-up tile");
  console.log("  EQUAL: loc_213d == oracle, non-negative -> table block base 0x38");
});

test("EQUAL (crafted): loc_213d == oracle stamps the fallback block on a negative selector", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, negEntry()), null, "loc_213d diverged on the negative branch");
  const a = negEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DEST], FALLBACK_TILE, "positive control: oracle stamped the fallback tile");
  console.log("  EQUAL: loc_213d == oracle, negative -> fallback block base 0xa4");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, nonNegEntry()), "no-op twin escaped (non-neg)");
  assert.ok(ramDiff(oracle, noOp, negEntry()), "no-op twin escaped (neg)");
  assert.ok(ramDiff(oracle, runFallback, nonNegEntry()), "wrong-branch twin escaped (fallback on non-neg)");
  assert.ok(ramDiff(oracle, wrongIndex, nonNegEntry()), "wrong-index twin escaped");
  assert.ok(ramDiff(oracle, wrongFallback, negEntry()), "wrong-fallback-tile twin escaped");
  console.log("  TEETH: no-op, wrong-branch, wrong-index, wrong-fallback all caught");
});
