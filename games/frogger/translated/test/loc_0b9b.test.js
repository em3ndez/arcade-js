// SPDX-License-Identifier: GPL-3.0-only
// loc_0b9b: write a 16-bit BCD value (DE) as four digits up the tilemap column (D high, E low).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0b9b } from "../loc_0b9b.js";
import { loc_0ba0 } from "../loc_0ba0.js";
import { loc_0ba9 } from "../loc_0ba9.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0ba0, loc_0ba0], [0x0ba9, loc_0ba9]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0b9b: DE=0x1234 -> digits 1,2,3,4 up the column; 275 T", () => {
  const m = mk();
  m.regs.de = 0x1234; m.regs.hl = 0xab60;
  loc_0b9b(m);
  assert.equal(vr(m, 0xab60), 0x01, "D high nibble");
  assert.equal(vr(m, 0xab40), 0x02, "D low nibble");
  assert.equal(vr(m, 0xab20), 0x03, "E high nibble");
  assert.equal(vr(m, 0xab00), 0x04, "E low nibble");
  assert.equal(m.regs.hl, 0xaae0, "HL stepped four rows up");
  assert.equal(m.cycles, 275, "T total");
});
