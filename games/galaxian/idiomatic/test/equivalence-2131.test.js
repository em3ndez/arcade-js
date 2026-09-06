// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2131 — memory-equivalent to the frozen oracle at ROM 0x2131. Tile-draw dispatcher: on carry in it
 * swaps DE/HL and stamps a 2x2 tile block selected by the signed B at the swapped-in pointer (a table block
 * for B>=0, the fixed fallback tile 0xa4 for B<0); with no carry it indexes the 0x2157 byte-table by B and
 * paints that code as a double-height glyph at the incoming HL. The oracle's ex de,hl / rst-20 / ex de,hl
 * dance only stashes HL across the pointer-clobbering fetch, so the destination is the incoming HL. Every
 * live-out is painted VRAM in the state dump -> ramDiff==null with a per-path positive control. The rst-20
 * fetch is a ROM call (an m.push16 seat), so an SP-seam tooth guards the dissolved dispatch on both paths; a
 * stack-adrift mutant is refused. Teeth: no-op, an always-block twin, and an always-double twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { u16 } from "../../../../core/int.js";
import { drawTileGlyphOrBlock as cand } from "../drawTileGlyphOrBlock.js";
import { loc_2131 as oracle } from "../../translated/loc_2131.js";
import { drawSelectedTileBlockOrFallback } from "../drawSelectedTileBlockOrFallback.js";
import { drawDoubleHeightTile } from "../drawDoubleHeightTile.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DEST = 0x5100;        // incoming HL: the double-height / swapped block destination (VRAM)
const OTHER = 0x5200;       // incoming DE (VRAM); a twin that skips the swap draws here instead
const INDEX_TABLE = 0x2157; // ROM byte-table indexed by B on the no-carry path
const BLOCK_TABLE = 0x215b; // ROM block table indexed by B on the carry (non-negative) path
const CELLS = [0, 1, 32, 33];

function blank(mem) { for (const base of [DEST, OTHER]) for (const o of CELLS) mem[base + o] = 0xff; }

const doubleHeight = () => craft((mem, mm) => {
  blank(mem); mm.push16(0x9999); mm.regs.fC = false; mm.regs.b = 0; mm.regs.hl = DEST; mm.regs.de = OTHER;
});
const carryBlock = () => craft((mem, mm) => {
  blank(mem); mm.push16(0x9999); mm.regs.fC = true; mm.regs.b = 0; mm.regs.hl = DEST; mm.regs.de = OTHER;
});
const carryFallback = () => craft((mem, mm) => {
  blank(mem); mm.push16(0x9999); mm.regs.fC = true; mm.regs.b = 0x80; mm.regs.hl = DEST; mm.regs.de = OTHER;
});

test("EQUAL (crafted): loc_2131 == oracle across carry/no-carry paths (RAM)", { skip }, () => {
  for (const [name, e] of [["doubleHeight", doubleHeight()], ["carryBlock", carryBlock()],
                           ["carryFallback", carryFallback()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `loc_2131 diverged on the ${name} path`);
  }
  const d = doubleHeight(); d.routines = STUBS; oracle(d);
  assert.equal(d.mem8[DEST], d.mem8[INDEX_TABLE], "positive control: double-height top not the index-table tile");
  assert.equal(d.mem8[DEST + 32], (d.mem8[INDEX_TABLE] + 2) & 0xff, "positive control: double-height bottom not tile+2");
  assert.equal(d.mem8[DEST + 1], 0xff, "positive control: double-height wrongly painted the second column");
  const cb = carryBlock(); cb.routines = STUBS; oracle(cb);
  assert.equal(cb.mem8[DEST], cb.mem8[BLOCK_TABLE], "positive control: carry block top not the block-table tile");
  assert.equal(cb.mem8[DEST + 1], (cb.mem8[BLOCK_TABLE] + 1) & 0xff, "positive control: carry block second column wrong");
  const cf = carryFallback(); cf.routines = STUBS; oracle(cf);
  assert.equal(cf.mem8[DEST], 0xa4, "positive control: fallback block top not the fixed tile 0xa4");
  console.log("  EQUAL: loc_2131 == oracle (RAM), double-height + carry block + carry fallback");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const alwaysBlock = (m, idx = m.regs.b) => drawSelectedTileBlockOrFallback(m, idx);
  const alwaysDouble = (m, idx = m.regs.b, hl = m.regs.hl) =>
    drawDoubleHeightTile(m, m.mem8[u16(INDEX_TABLE + idx)], hl);
  assert.ok(ramDiff(oracle, noOp, doubleHeight()), "the no-op twin escaped (double-height)");
  assert.ok(ramDiff(oracle, alwaysBlock, doubleHeight()), "the always-block twin escaped (double-height)");
  assert.ok(ramDiff(oracle, alwaysDouble, carryBlock()), "the always-double twin escaped (carry block)");
  console.log("  TEETH: no-op, always-block, always-double all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["doubleHeight", doubleHeight()], ["carryBlock", carryBlock()]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x2131, e);
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x2131, doubleHeight());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on double-height + carry block; stack-adrift mutant refused");
});
