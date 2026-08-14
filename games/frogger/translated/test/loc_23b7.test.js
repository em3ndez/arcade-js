// SPDX-License-Identifier: GPL-3.0-only
// loc_23b7: in-play river-object arrival setup — clears the four lane mirror flags, or tail-jumps to a
// lane's B3 commit handler when its direction flag is set.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_23b7 } from "../loc_23b7.js";
import { loc_1bba, loc_1c0d } from "../loc_1b8b.js";
import { loc_1c76, loc_1cd5 } from "../loc_1c41.js";

function mk() {
  const routines = new Map([
    [0x1bba, loc_1bba], [0x1c0d, loc_1c0d], [0x1c76, loc_1c76], [0x1cd5, loc_1cd5],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const wr = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_23b7: all lanes clear -> writes 0 to 0x824c-0x824f; 190 T", () => {
  const m = mk();
  for (const a of [0x824c, 0x824d, 0x824e, 0x824f]) m.mem.write8(a, 0xff);
  loc_23b7(m);
  assert.equal(wr(m, 0x824c), 0x00, "lane-0 mirror cleared");
  assert.equal(wr(m, 0x824d), 0x00, "lane-1 mirror cleared");
  assert.equal(wr(m, 0x824e), 0x00, "lane-2 mirror cleared");
  assert.equal(wr(m, 0x824f), 0x00, "lane-3 mirror cleared");
  assert.equal(m.cycles, 190, "T total");
});

test("loc_23b7: lane-0 flag set -> tail-jump loc_1bba (early-ret); 75 T", () => {
  const m = mk();
  m.mem.write8(0x8248, 0x01); // lane-0 direction set
  m.mem.write8(0x824c, 0xff); // lane-0 already arrived -> loc_1bba rets at once
  loc_23b7(m);
  assert.equal(wr(m, 0x8248), 0x01, "direction flag untouched");
  assert.equal(wr(m, 0x824c), 0xff, "handler early-ret, no write");
  assert.equal(m.cycles, 75, "T total incl. loc_1bba early ret");
});

test("loc_23b7: lanes 0/1 clear, lane-2 set -> tail-jump loc_1c76 (early-ret); 155 T", () => {
  const m = mk();
  for (const a of [0x824c, 0x824d]) m.mem.write8(a, 0xff);
  m.mem.write8(0x824a, 0x01); // lane-2 direction set
  m.mem.write8(0x824e, 0xff); // lane-2 already arrived -> loc_1c76 rets at once
  loc_23b7(m);
  assert.equal(wr(m, 0x824c), 0x00, "lane-0 mirror cleared before the branch");
  assert.equal(wr(m, 0x824d), 0x00, "lane-1 mirror cleared before the branch");
  assert.equal(wr(m, 0x824e), 0xff, "handler early-ret, no write");
  assert.equal(m.cycles, 155, "T total incl. loc_1c76 early ret");
});
