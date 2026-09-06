// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2055 — crafted-entry equivalence vs the frozen draw-dispatch entry at ROM 0x2055.
 * Maps the packed coordinate in A to a VRAM cell, biases that same coordinate (the mapper copies it into B,
 * which the variant fold reads) into a timer-animated tile variant, then draws at that cell: coordinate bit 4
 * set -> a 2x2 block selected by the variant (fixed fallback tile 0xa4 when the variant saturates negative),
 * clear -> a double-height glyph fetched from the index table. Every live-out is painted VRAM, so ramDiff
 * carries the verdict. Paths: double-height, carry block, carry fallback (coord >= 112 saturates the variant
 * to the negative marker). With the frame counter poked to 0, coords 0x05/0x15 fold the variant to 0, so the
 * drawn codes are the table entries at index 0. Teeth: no-op, an always-block
 * twin (wrong on double-height), an always-double twin (wrong on the block). An SP-seam tooth guards the
 * dissolved tail-dispatch; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { drawAnimatedTileFigureAtPackedCoord as cand } from "../drawAnimatedTileFigureAtPackedCoord.js";
import { loc_2055 as oracle } from "../../translated/loc_2055.js";
import { mapPackedCoordToVram } from "../mapPackedCoordToVram.js";
import { computeTileVariantFromValueAndTimer } from "../computeTileVariantFromValueAndTimer.js";
import { drawTileGlyphOrBlock } from "../drawTileGlyphOrBlock.js";
import { VRAM_BASE } from "../names.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const COUNTER = 0x425f;     // frame counter the variant fold reads
const INDEX_TABLE = 0x2157; // double-height glyph codes, indexed by the variant
const BLOCK_TABLE = 0x215b; // 2x2 block codes, indexed by the variant
const FALLBACK = 0xa4;      // block code stamped when the variant saturates negative
const ROW = 32;             // one tilemap row

const COORD_DH = 0x05;  // bit 4 clear -> double-height; coord folds to variant 0
const COORD_BLK = 0x15; // bit 4 set   -> 2x2 block; coord folds to variant 0
const COORD_FB = 0xf5;  // bit 4 set + coord >= 112 -> variant saturates to the negative marker -> fixed fallback

// The mapper copies the coord into B and the variant fold reads B, so the COORD (not the entry B) drives the
// variant; counter=0 folds COORD_DH/COORD_BLK to index 0, so the drawn codes are the table entries at 0.
const doubleHeight = () => craft((mem, mm) => { mm.push16(0x9999); mm.regs.a = COORD_DH; mem[COUNTER] = 0; });
const carryBlock = () => craft((mem, mm) => { mm.push16(0x9999); mm.regs.a = COORD_BLK; mem[COUNTER] = 0; });
const carryFallback = () => craft((mem, mm) => { mm.push16(0x9999); mm.regs.a = COORD_FB; mem[COUNTER] = 0; });

// The mapper is a pure coord->cell function; run it on a throwaway to learn where a coord draws.
function cellFor(coord) { return mapPackedCoordToVram(craft(), coord); }
function runOracle(e) { e.routines = STUBS; oracle(e); return e; }

test("EQUAL (crafted): loc_2055 == oracle across double-height / block / fallback (RAM)", { skip }, () => {
  for (const [name, e] of [["doubleHeight", doubleHeight()], ["carryBlock", carryBlock()],
                           ["carryFallback", carryFallback()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `loc_2055 diverged on the ${name} path`);
  }
  console.log("  EQUAL: loc_2055 == oracle (RAM) on double-height + carry block + carry fallback");
});

test("positive controls: each path draws its figure at the mapped cell", { skip }, () => {
  const cellDH = cellFor(COORD_DH);
  const dh = runOracle(doubleHeight());
  assert.equal(dh.mem8[cellDH], dh.mem8[INDEX_TABLE], "double-height top not the index-table code");
  assert.equal(dh.mem8[cellDH + ROW], (dh.mem8[INDEX_TABLE] + 2) & 0xff, "double-height bottom not code+2");

  const cellBLK = cellFor(COORD_BLK);
  const cb = runOracle(carryBlock());
  assert.equal(cb.mem8[cellBLK], cb.mem8[BLOCK_TABLE], "carry block top not the block-table code");
  assert.equal(cb.mem8[cellBLK + 1], (cb.mem8[BLOCK_TABLE] + 1) & 0xff, "carry block second column wrong");

  const cellFB = cellFor(COORD_FB);
  const cf = runOracle(carryFallback());
  assert.equal(cf.mem8[cellFB], FALLBACK, "carry fallback top not the fixed tile 0xa4");
  console.log("  positive: double-height, block, and fallback each paint the mapped cell");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const alwaysBlock = (m) => {
    const cell = mapPackedCoordToVram(m, m.regs.a);
    const v = computeTileVariantFromValueAndTimer(m, m.regs.a);
    return drawTileGlyphOrBlock(m, true, v, cell, VRAM_BASE);
  };
  const alwaysDouble = (m) => {
    const cell = mapPackedCoordToVram(m, m.regs.a);
    const v = computeTileVariantFromValueAndTimer(m, m.regs.a);
    return drawTileGlyphOrBlock(m, false, v, cell, VRAM_BASE);
  };
  assert.ok(ramDiff(oracle, noOp, doubleHeight()), "the no-op twin escaped (double-height)");
  assert.ok(ramDiff(oracle, alwaysBlock, doubleHeight()), "the always-block twin escaped (double-height)");
  assert.ok(ramDiff(oracle, alwaysDouble, carryBlock()), "the always-double twin escaped (carry block)");
  console.log("  TEETH: no-op, always-block, always-double all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["doubleHeight", doubleHeight()], ["carryBlock", carryBlock()]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x2055, e);
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x2055, doubleHeight());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on double-height + carry block; stack-adrift mutant refused");
});
