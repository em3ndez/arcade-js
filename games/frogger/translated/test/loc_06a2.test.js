// SPDX-License-Identifier: GPL-3.0-only
// loc_06a2: cp-ladder home-marker dispatcher -- one empty-slot block per lane, or delegate on 0x10.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_06a2 } from "../loc_06a2.js";
import { loc_0670 } from "../loc_0670.js"; // same-cluster sibling -- real (0x10 path)
import { loc_0695 } from "../loc_0695.js"; // same-cluster sibling -- real (via loc_0670)

function mk() {
  const stub0a5f = () => {}; // cross-cluster [B4] -- merge wires the real loc_0a5f
  const routines = new Map([[0x0670, loc_0670], [0x0695, loc_0695], [0x0a5f, stub0a5f]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];
const wr = (m, a) => m.mem.workRam[a - 0x8000];

// lane value -> [slot base, own T-total]. Each ladder step is cp(7)+jp z(10); arm+tail add 103.
const ARMS = [
  [0xc0, 0xab64, 120],
  [0x90, 0xaaa4, 137],
  [0x70, 0xa9e4, 154],
  [0x50, 0xa924, 171],
  [0x30, 0xa864, 188],
];

for (const [lane, base, tstates] of ARMS) {
  test(`loc_06a2: A=0x${lane.toString(16)} stamps empty block at 0x${base.toString(16)}; ${tstates} T`, () => {
    const m = mk();
    m.regs.a = lane;
    loc_06a2(m);
    assert.equal(vr(m, base + 0x00), 0xfc, "top-left");
    assert.equal(vr(m, base + 0x01), 0xfd, "top-right");
    assert.equal(vr(m, base + 0x20), 0xfe, "bottom-left");
    assert.equal(vr(m, base + 0x21), 0xff, "bottom-right");
    assert.equal(m.cycles, tstates, "T total");
  });
}

test("loc_06a2: A=0x10 delegates to loc_0670 (all five 0x10 blocks); 654 T", () => {
  const m = mk();
  m.regs.a = 0x10;
  loc_06a2(m);
  assert.equal(vr(m, 0xab64), 0x10, "first slot stamped by loc_0670");
  assert.equal(vr(m, 0xa864), 0x10, "last slot stamped by loc_0670");
  assert.equal(wr(m, 0x842f), 0x00, "loc_0670 cleared 0x842f");
  assert.equal(m.cycles, 654, "T total (ladder + loc_0670)");
});

test("loc_06a2: A=0x00 matches no lane, returns; 112 T; no writes", () => {
  const m = mk();
  m.regs.a = 0x00;
  loc_06a2(m);
  assert.equal(vr(m, 0xab64), 0x00, "no video write");
  assert.equal(wr(m, 0x842f), 0x00, "no work-ram write");
  assert.equal(m.cycles, 112, "T total (6 ladder steps + ret)");
});
