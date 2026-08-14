// SPDX-License-Identifier: GPL-3.0-only
// loc_230f: once-per-life start-of-play setup. Boot/attract (mode!=1) rets at 0x2313.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_230f } from "../loc_230f.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}

test("loc_230f: mode != 1 rets immediately (attract/boot); 28 T", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x00; // mode 0
  loc_230f(m);
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
  assert.equal(m.cycles, 13 + 4 + 11, "ld,dec,ret nz");
});

test("loc_230f: mode==1 but run flag set rets at the second guard", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x01; m.mem.workRam[0x29b] = 0x01;
  loc_230f(m);
  assert.equal(m.pc, 0xbeef, "ret nz on the run flag");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_230f.js
//   find: m.step(0x2312, 13); // A = (0x83d6) mode byte
//   repl: m.step(0x2312, 12);
//   expect: FAIL (state-invisible mode-read undercharge; only the cycle total catches it)
//   verified-anchor: count == 1
test("loc_230f: the cycle total catches a mistimed mode read", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x00;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x2312 && t === 13 ? 12 : t);
  loc_230f(m);
  assert.equal(m.pc, 0xbeef, "state unchanged");
  assert.equal(m.cycles, 27, "the 1-T undercharge shows");
});
