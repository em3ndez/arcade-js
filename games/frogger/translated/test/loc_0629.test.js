// SPDX-License-Identifier: GPL-3.0-only
// loc_0629: clear the two score cursors + set (0x83CC)=1, then 0x20 passes of paired loc_0779 fills.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0629 } from "../loc_0629.js";
import { loc_07e6, loc_07eb } from "../loc_07e6.js";
import { loc_0779 } from "../loc_0779.js";

function mk() {
  const routines = new Map([[0x07e6, loc_07e6], [0x07eb, loc_07eb], [0x0779, loc_0779]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0629: cursors cleared, (0x83CC)=1, score field seeded; 21099 T", () => {
  const m = mk();
  loc_0629(m);
  assert.equal(m.mem.read8(0x839a), 0x00, "score cursor lo");
  assert.equal(m.mem.read8(0x839b), 0x00, "score cursor hi");
  assert.equal(m.mem.read8(0x83cc), 0x01, "(0x83cc) flag");
  // first pass: two 10-cell fills of tile 0x10 with a 2-cell gap between the columns
  assert.equal(vr(m, 0xa806), 0x10, "col A start");
  assert.equal(vr(m, 0xa80f), 0x10, "col A end");
  assert.equal(vr(m, 0xa810), 0x00, "gap between columns");
  assert.equal(vr(m, 0xa812), 0x10, "col B start");
  assert.equal(vr(m, 0xabfb), 0x10, "last cell of the final pass");
  assert.equal(m.regs.hl, 0xac06, "HL below the field after 0x20 passes");
  assert.equal(m.regs.sp, 0x8800, "stack unwound");
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.cycles, 21099, "T total incl. loc_07e6 + 64x loc_0779");
});
