// SPDX-License-Identifier: GPL-3.0-only
// loc_05d3: set the 2-player / demo start flags. Leaf.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_05d3 } from "../loc_05d3.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const rd = (m, a) => m.mem.read8(a);

test("loc_05d3: sets 2P/demo start flags; 126 T", () => {
  const m = mk();
  loc_05d3(m);
  assert.equal(rd(m, 0x826d), 0x01, "(0x826d) = 1");
  assert.equal(rd(m, 0x825a), 0x01, "(0x825a) = 1");
  assert.equal(rd(m, 0x83cd), 0x01, "(0x83cd) = 1");
  assert.equal(rd(m, 0x825b), 0x00, "(0x825b) = 0");
  assert.equal(rd(m, 0x83ea), 0x00, "(0x83ea) = 0");
  assert.equal(rd(m, 0x8297), 0xff, "(0x8297) = 0xff");
  assert.equal(rd(m, 0x8298), 0x40, "(0x8298) = 0x40");
  assert.equal(m.regs.sp, 0x8800, "SP restored (ret popped sentinel)");
  assert.equal(m.cycles, 126, "T total");
});
