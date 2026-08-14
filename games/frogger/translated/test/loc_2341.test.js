// SPDX-License-Identifier: GPL-3.0-only
// loc_2341: in-play per-frame update. Boot/attract (mode!=1) rets at 0x2345; mode==1 with run flag
// set runs the call sequence (dead in attract).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2341 } from "../loc_2341.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_2341: mode != 1 rets immediately (attract/boot); 33 T", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x05; // mode 5 (attract)
  loc_2341(m);
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
  assert.equal(m.cycles, 13 + 4 + 11, "ld,dec,ret nz");
});

test("loc_2341: mode==1 but run flag 0 rets at the second guard", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x01; m.mem.workRam[0x29b] = 0x00;
  loc_2341(m);
  assert.equal(m.pc, 0xbeef, "ret z on the run flag");
  assert.equal(r(m, 0x829b), 0x00, "run flag untouched");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2341.js
//   find: m.step(0x2344, 13); // A = (0x83d6) game-mode byte
//   repl: m.step(0x2344, 12);
//   expect: FAIL (the ld a,(0x83d6) undercharge is state-invisible; only the cycle total catches it)
//   verified-anchor: count == 1
test("loc_2341: the cycle total catches a mistimed mode read", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x05;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x2344 && t === 13 ? 12 : t);
  loc_2341(m);
  assert.equal(m.pc, 0xbeef, "state unchanged by the timing mutation");
  assert.equal(m.cycles, 27, "the 1-T undercharge shows in the total");
});
