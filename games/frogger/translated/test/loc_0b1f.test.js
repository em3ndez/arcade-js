// SPDX-License-Identifier: GPL-3.0-only
// loc_0b1f: redraw the score header each frame (label strips via rst 0x28, P1/HI/P2 scores via the
// BCD cluster). Single player ((0x8370)==1) rets before the P2 score.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0b1f } from "../loc_0b1f.js";
import { loc_0b95 } from "../loc_0b95.js";
import { loc_0b9b } from "../loc_0b9b.js";
import { loc_0ba0 } from "../loc_0ba0.js";
import { loc_0ba9 } from "../loc_0ba9.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const routines = new Map([
    [0x0028, bal], [0x0b95, loc_0b95], [0x0b9b, loc_0b9b], [0x0ba0, loc_0ba0], [0x0ba9, loc_0ba9],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

test("loc_0b1f: single player draws two label strips + P1/HI scores, rets before P2; 958 T", () => {
  const m = mk();
  m.mem.workRam[0x3ef] = 0x34; m.mem.workRam[0x3f0] = 0x12; // P1 score
  m.mem.workRam[0x370] = 0x01; // 1 player
  loc_0b1f(m);
  const rst28 = m.calls.filter((a) => a === 0x0028).length;
  assert.equal(rst28, 2, "the '1UP' and 'HI' strips only (no '2UP')");
  assert.equal(m.pc, 0xbeef, "ret z on single player");
  assert.equal(m.cycles, 958, "single-player T total");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0b1f.js
//   find: m.step(0x0b2f, 20); // DE = (0x83ef) P1 score (BCD)
//   repl: m.step(0x0b2f, 19);
//   expect: FAIL (undercharges the ld de,(0x83ef); the drawn score is identical, only cycles move)
//   verified-anchor: count == 1
test("loc_0b1f: the cycle total catches a mistimed score load", () => {
  const m = mk();
  m.mem.workRam[0x370] = 0x01;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0b2f && t === 20 ? 19 : t);
  loc_0b1f(m);
  assert.equal(m.pc, 0xbeef, "render unchanged by the timing mutation");
  assert.equal(m.cycles, 957, "1-T undercharge shows");
});
