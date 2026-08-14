// SPDX-License-Identifier: GPL-3.0-only
// loc_0670: stamp all five home-frog slot markers via loc_0695, clear 0x842f, tail-jump loc_0a5f.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0670 } from "../loc_0670.js";
import { loc_0695 } from "../loc_0695.js"; // same-cluster sibling -- real

// Slot bases (call sites) and the 2x2 offsets loc_0695 fills at each.
const BASES = [0xab64, 0xaaa4, 0xa9e4, 0xa924, 0xa864];
const OFFS = [0x00, 0x01, 0x20, 0x21];

function mk() {
  const stub0a5f = () => {}; // cross-cluster [B4] -- merge wires the real loc_0a5f
  const routines = new Map([[0x0695, loc_0695], [0x0a5f, stub0a5f]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];
const wr = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_0670: five 0x10-marker blocks + clear 0x842f; 552 T", () => {
  const m = mk();
  loc_0670(m);
  for (const base of BASES)
    for (const off of OFFS)
      assert.equal(vr(m, base + off), 0x10, `tile 0x${(base + off).toString(16)}`);
  assert.equal(wr(m, 0x842f), 0x00, "(0x842f) cleared");
  assert.equal(m.regs.a, 0x00, "A = 0 after xor a");
  assert.equal(m.cycles, 552, "T total (5x loc_0695 + own)");
});
