// SPDX-License-Identifier: GPL-3.0-only
// loc_07ce: 2-player start-flag helper; sets (0x825b)=1 only when (0x826d)!=0. Leaf.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_07ce } from "../loc_07ce.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const rd = (m, a) => m.mem.read8(a);

test("loc_07ce: (0x826d)!=0 sets (0x825b)=1; 52 T", () => {
  const m = mk();
  m.mem.write8(0x826d, 0x01);
  loc_07ce(m);
  assert.equal(rd(m, 0x825b), 0x01, "start flag set");
  assert.equal(m.regs.sp, 0x8800, "SP restored");
  assert.equal(m.cycles, 52, "T total (flag-set path)");
});

test("loc_07ce: (0x826d)==0 returns without touching (0x825b); 28 T", () => {
  const m = mk();
  m.mem.write8(0x826d, 0x00);
  m.mem.write8(0x825b, 0x77); // sentinel: must survive
  loc_07ce(m);
  assert.equal(rd(m, 0x825b), 0x77, "flag untouched on ret z");
  assert.equal(m.regs.sp, 0x8800, "SP restored");
  assert.equal(m.cycles, 28, "T total (ret z path)");
});
