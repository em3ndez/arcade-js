// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1ccf — crafted-entry memory-equivalence vs the frozen descriptor indexer.
 * It indexes the 5-byte text-draw descriptor table by A and paints that column into VRAM, so ramDiff is
 * the whole live-out (return-stack window masked). The seed selects a nonzero index (3), so both the
 * record stride and base matter, and pre-dirties the descriptor's bottom cell with a sentinel that differs
 * from the tile the paint stamps there, so the paint is demonstrably non-vacuous. Positive control: the
 * bottom cell is repainted with the mapped tile. Teeth: no-op and two wrong indices (distinct columns).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_1ccf as cand } from "../loc_1ccf.js";
import { loc_1ccf as oracle } from "../../translated/loc_1ccf.js";

const TABLE = 0x1cf6, STRIDE = 5, INDEX = 3, CHAR_ZERO = 48;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// Descriptor fields for the seeded index (source word, dest word) and the tile stamped at the bottom cell.
function descriptor(mem) {
  const base = TABLE + INDEX * STRIDE;
  const source = mem[base] | (mem[base + 1] << 8);
  const dest = mem[base + 2] | (mem[base + 3] << 8);
  const tile = (mem[source] - CHAR_ZERO) & 0xff;
  return { source, dest, tile };
}

// Select index 3 in A; dirty its bottom cell with a sentinel guaranteed != the tile; lay the ret.
const entry = () => craft((mem, mm) => {
  mm.regs.a = INDEX;
  const { dest, tile } = descriptor(mem);
  mem[dest] = tile ^ 0xff;
  mm.push16(0x9999);
});

test("EQUAL (crafted): loc_1ccf == oracle paints the indexed descriptor column", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "the descriptor paint diverged");
  // non-vacuous: the bottom cell is repainted from the sentinel to the mapped tile.
  const a = entry(); oracle(a);
  const { dest, tile } = descriptor(a.mem8);
  assert.equal(a.mem8[dest], tile, "positive control: bottom cell not painted with the mapped tile");
  console.log("  EQUAL: loc_1ccf == oracle on descriptor index 3");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongIndex4 = (m) => { m.regs.a = 4; cand(m); };
  const wrongIndex8 = (m) => { m.regs.a = 8; cand(m); };
  assert.ok(ramDiff(oracle, noOp, entry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongIndex4, entry()), "wrong-index (4) twin escaped");
  assert.ok(ramDiff(oracle, wrongIndex8, entry()), "wrong-index (8) twin escaped");
  console.log("  TEETH: no-op, wrong-index 4, wrong-index 8 all caught");
});
