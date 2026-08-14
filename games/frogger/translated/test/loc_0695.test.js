// SPDX-License-Identifier: GPL-3.0-only
// loc_0695: stamp a 2x2 block of tile 0x10 at HL (offsets 0,1,0x20,0x21).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0695 } from "../loc_0695.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0695: HL=0xab64 stamps the 2x2 block with 0x10; 78 T", () => {
  const m = mk();
  m.regs.hl = 0xab64;
  loc_0695(m);
  assert.equal(vr(m, 0xab64), 0x10, "top-left");
  assert.equal(vr(m, 0xab65), 0x10, "top-right");
  assert.equal(vr(m, 0xab84), 0x10, "bottom-left");
  assert.equal(vr(m, 0xab85), 0x10, "bottom-right");
  assert.equal(m.regs.a, 0x10, "A = marker tile");
  assert.equal(m.regs.hl, 0xab85, "HL at last cell");
  assert.equal(m.cycles, 78, "T total");
});
