// SPDX-License-Identifier: GPL-3.0-only
// loc_0779: fill B=0x0a consecutive tilemap cells from HL with tile C=0x10; HL ends past the run.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0779 } from "../loc_0779.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0779: stamps 10 tiles from HL, HL += 10, BC = 0x0010; 275 T", () => {
  const m = mk();
  m.regs.hl = 0xa806;
  loc_0779(m);
  for (let a = 0xa806; a <= 0xa80f; a++) assert.equal(vr(m, a), 0x10, `filled ${a.toString(16)}`);
  assert.equal(vr(m, 0xa810), 0x00, "one past the run untouched");
  assert.equal(m.regs.hl, 0xa810, "HL past the 10 cells");
  assert.equal(m.regs.bc, 0x0010, "B decremented to 0, C = tile");
  assert.equal(m.regs.sp, 0x8800, "stack unwound");
  assert.equal(m.cycles, 275, "T total");
});

test("loc_0779: same 10-cell run from a different HL", () => {
  const m = mk();
  m.regs.hl = 0xa9c0;
  loc_0779(m);
  for (let a = 0xa9c0; a <= 0xa9c9; a++) assert.equal(vr(m, a), 0x10, `filled ${a.toString(16)}`);
  assert.equal(m.regs.hl, 0xa9ca, "HL past the run");
  assert.equal(m.cycles, 275, "count is fixed by BC, HL-independent");
});
