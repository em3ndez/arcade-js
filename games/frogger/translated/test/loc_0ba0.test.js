// SPDX-License-Identifier: GPL-3.0-only
// loc_0ba0: write a packed BCD byte (A) as two digits (high then low) up the tilemap column.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0ba0 } from "../loc_0ba0.js";
import { loc_0ba9 } from "../loc_0ba9.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0ba9, loc_0ba9]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0ba0: 0x37 -> high digit 3 then low digit 7; 129 T", () => {
  const m = mk();
  m.regs.hl = 0xab20; m.regs.a = 0x37;
  loc_0ba0(m);
  assert.equal(vr(m, 0xab20), 0x03, "high nibble at the first cell");
  assert.equal(vr(m, 0xab00), 0x07, "low nibble one row up");
  assert.equal(m.regs.hl, 0xaae0, "HL stepped two rows up");
  assert.equal(m.cycles, 129, "T total including the two loc_0ba9 calls");
});
