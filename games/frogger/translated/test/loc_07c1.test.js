// SPDX-License-Identifier: GPL-3.0-only
// loc_07c1: start-flag helper; delegates to loc_07ce when (0x83fd)==1, else sets (0x825b)=1.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_07c1 } from "../loc_07c1.js";
import { loc_07ce } from "../loc_07ce.js";

function mk() {
  const routines = new Map([[0x07ce, loc_07ce]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const rd = (m, a) => m.mem.read8(a);

test("loc_07c1: (0x83fd)!=1 falls through, sets (0x825b)=1; 57 T", () => {
  const m = mk();
  m.mem.write8(0x83fd, 0x00); // dec -> 0xff, NZ
  loc_07c1(m);
  assert.equal(rd(m, 0x825b), 0x01, "start flag set on fall-through");
  assert.equal(m.regs.sp, 0x8800, "SP restored");
  assert.equal(m.cycles, 57, "T total (fall-through path)");
});

test("loc_07c1: (0x83fd)==1 delegates to loc_07ce (which sets flag when (0x826d)!=0); 79 T", () => {
  const m = mk();
  m.mem.write8(0x83fd, 0x01); // dec -> 0, Z: jp z
  m.mem.write8(0x826d, 0x01); // loc_07ce sees non-zero -> sets flag
  loc_07c1(m);
  assert.equal(rd(m, 0x825b), 0x01, "loc_07ce set the flag");
  assert.equal(m.regs.sp, 0x8800, "SP restored via tail jp + callee ret");
  assert.equal(m.cycles, 79, "T total (delegated path, (0x826d)!=0)");
});
