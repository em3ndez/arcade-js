// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_205e — memory-equivalent to the frozen oracle at ROM 0x205e (dissolves its call of the coordinate
 * mapper and both tail-jumps into the tile writers into direct idiomatic calls). It maps a packed
 * coordinate (register A) to a VRAM cell, then branches on the mapper's carry live-out (coord bit 4):
 * set -> stamp a 2x2 tile block, clear -> stamp a vertical tile pair. Live-out is RAM only (VRAM); the
 * mapper's/writers' trailing registers are overwritten by the caller. The seeds pick coords whose cells
 * land in the VRAM interior and pre-poke sentinels so every write is observable. Teeth: no-op, a
 * block-with-a-missing-row, and a wrong-shape (vertical drawn where a block belongs).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { drawFixedTileFigureAtPackedCoord as cand } from "../drawFixedTileFigureAtPackedCoord.js";
import { loc_205e as oracle } from "../../translated/loc_205e.js";

const BLOCK_COORD = 0x11;   // bit4 set -> 2x2 block; maps to VRAM cell 0x504d
const BLOCK_CELL = 0x504d;
const VERT_COORD = 0x01;    // bit4 clear -> vertical pair; maps to VRAM cell 0x504f
const VERT_CELL = 0x504f;
const SEED = 44;            // the fixed tile code both writers seed
const SENTINEL = 0xee;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const blockEntry = () => craft((mem8, m) => {
  m.push16(0x9999); m.regs.a = BLOCK_COORD;
  for (const off of [0, 1, 0x20, 0x21]) mem8[BLOCK_CELL + off] = SENTINEL;
});
const vertEntry = () => craft((mem8, m) => {
  m.push16(0x9999); m.regs.a = VERT_COORD;
  for (const off of [0, 0x20]) mem8[VERT_CELL + off] = SENTINEL;
});

test("EQUAL (crafted): loc_205e == oracle on the block and vertical branches (RAM)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, blockEntry()), null, "loc_205e diverged on the block branch");
  assert.equal(ramDiff(oracle, cand, vertEntry()), null, "loc_205e diverged on the vertical branch");
  // positive control: block branch stamps the 2x2 tile block 0x2c..0x2f.
  const b = blockEntry(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[BLOCK_CELL], SEED, "positive control: block top-left tile");
  assert.equal(b.mem8[BLOCK_CELL + 0x21], SEED + 3, "positive control: block bottom-right tile");
  // positive control: vertical branch stamps the double-height pair.
  const v = vertEntry(); v.routines = STUBS; oracle(v);
  assert.equal(v.mem8[VERT_CELL], SEED, "positive control: vertical top tile");
  assert.equal(v.mem8[VERT_CELL + 0x20], SEED + 2, "positive control: vertical bottom tile");
  console.log("  EQUAL: loc_205e == oracle (RAM), block + vertical branches verified");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const blockTopOnly = (m) => { m.mem8[BLOCK_CELL] = SEED; m.mem8[BLOCK_CELL + 1] = SEED + 1; }; // missing bottom row
  const vertOnBlock = (m) => { m.mem8[BLOCK_CELL] = SEED; m.mem8[BLOCK_CELL + 0x20] = SEED + 2; }; // vertical, wrong shape
  assert.ok(ramDiff(oracle, noOp, blockEntry()), "the no-op twin escaped (block)");
  assert.ok(ramDiff(oracle, blockTopOnly, blockEntry()), "the block-top-only twin escaped");
  assert.ok(ramDiff(oracle, vertOnBlock, blockEntry()), "the wrong-shape twin escaped");
  assert.ok(ramDiff(oracle, noOp, vertEntry()), "the no-op twin escaped (vertical)");
  console.log("  TEETH: no-op, block-top-only, wrong-shape all caught");
});
