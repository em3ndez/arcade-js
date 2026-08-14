// SPDX-License-Identifier: GPL-3.0-only
// loc_0766: fill a 0x1C-wide x 0x20-tall block at 0xA802 with tile 0x10, skipping 4 columns per row.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0766 } from "../loc_0766.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0766: fills 0x1C-wide rows with 0x10; 24,256 T", () => {
  const m = mk();
  loc_0766(m);
  assert.equal(vr(m, 0xa802), 0x10, "first cell filled");
  assert.equal(vr(m, 0xa81d), 0x10, "last cell of row 0 filled (0x1C wide)");
  assert.equal(vr(m, 0xa81e), 0x00, "the 4 skipped columns stay clear");
  assert.equal(vr(m, 0xabfd), 0x10, "last cell of the last row filled");
  assert.equal(m.regs.hl, 0xac02, "HL one row past the block");
  assert.equal(m.regs.d, 0, "row counter exhausted");
  assert.equal(m.cycles, 24256, "T total (rows x per-row djnz)");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0766.js
//   find: m.step(0x0772, 6);
//   repl: m.step(0x0772, 5);
//   expect: FAIL (the inc-hl in the inner fill loop is undercharged; VRAM is identical, cycles move)
//   verified-anchor: count == 1
test("loc_0766: the cycle total catches a mistimed inner step", () => {
  const m = mk();
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0772 && t === 6 ? 5 : t);
  loc_0766(m);
  assert.equal(vr(m, 0xa802), 0x10, "VRAM unchanged by the timing mutation");
  assert.notEqual(m.cycles, 24256, "cycle total shifted");
});
