// SPDX-License-Identifier: GPL-3.0-only
// loc_0b67: draw the credit line. First call ((0x83B4)==0) paints a 0x20-cell column at 0xA81F with
// tile 0x10 and latches (0x83B4)=1; every call blits the "CREDIT" label and prints the count.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0b67 } from "../loc_0b67.js";
import { loc_0ba0 } from "../loc_0ba0.js";
import { loc_0ba9 } from "../loc_0ba9.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const routines = new Map([[0x0028, bal], [0x0ba0, loc_0ba0], [0x0ba9, loc_0ba9]]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0b67: first call clears the credit column, latches the flag, prints the count; 1,270 T", () => {
  const m = mk();
  m.mem.workRam[0x3b4] = 0; m.mem.workRam[0x3e1] = 0x07;
  loc_0b67(m);
  assert.equal(m.mem.workRam[0x3b4], 1, "one-time init flag latched");
  assert.equal(vr(m, 0xa81f), 0x10, "credit column cleared to tile 0x10");
  assert.equal(m.mem.workRam[0x03f], 1, "(0x803f) set");
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.cycles, 1270, "first-call T total");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0b67.js
//   find: m.step(0x0b71, 13);
//   repl: m.step(0x0b71, 12);
//   expect: FAIL (undercharges the ld (0x83b4),a latch store; state identical, only cycles move)
//   verified-anchor: count == 1
test("loc_0b67: the cycle total catches a mistimed latch store", () => {
  const m = mk();
  m.mem.workRam[0x3b4] = 0;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0b71 && t === 13 ? 12 : t);
  loc_0b67(m);
  assert.equal(m.mem.workRam[0x3b4], 1, "state unchanged by the timing mutation");
  assert.equal(m.cycles, 1269, "1-T undercharge shows");
});
