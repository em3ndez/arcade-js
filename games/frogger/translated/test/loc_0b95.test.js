// SPDX-License-Identifier: GPL-3.0-only
// loc_0b95: draw a 4-digit BCD field (DE) then a leading 0 at the field's top cell.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0b95 } from "../loc_0b95.js";
import { loc_0b9b } from "../loc_0b9b.js";
import { loc_0ba0 } from "../loc_0ba0.js";
import { loc_0ba9 } from "../loc_0ba9.js";

function mk() {
  const routines = new Map([[0x0b9b, loc_0b9b], [0x0ba0, loc_0ba0], [0x0ba9, loc_0ba9]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0b95: DE=0x1234 four digits + leading 0; 348 T", () => {
  const m = mk();
  m.regs.de = 0x1234; m.regs.hl = 0xab60;
  loc_0b95(m);
  assert.equal(vr(m, 0xab60), 0x01, "first digit");
  assert.equal(vr(m, 0xaae0), 0x00, "leading 0 above the four digits");
  assert.equal(m.regs.hl, 0xaac0, "HL past the leading 0");
  assert.equal(m.cycles, 348, "T total");
});
