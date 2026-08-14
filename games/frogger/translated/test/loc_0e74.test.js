// SPDX-License-Identifier: GPL-3.0-only
// loc_0e74: force game-mode (0x83D6) to 5 and ret.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0e74 } from "../loc_0e74.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}

test("loc_0e74: (0x83d6) = 5; 30 T; rets to caller", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x11;
  loc_0e74(m);
  assert.equal(m.mem.workRam[0x3d6], 0x05, "mode byte forced to 5");
  assert.equal(m.cycles, 30, "7 + 13 + 10");
  assert.equal(m.pc, 0xbeef, "returned to caller");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0e74.js
//   find: m.step(0x0e79, 13); // (0x83d6) = 5 -- game-mode byte
//   repl: m.step(0x0e79, 12);
//   expect: FAIL (undercharges the ld (0x83d6),a by 1 T; the store still lands, only the total moves)
//   verified-anchor: count == 1
test("loc_0e74: the cycle total catches a mistimed store", () => {
  const m = mk();
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0e79 && t === 13 ? 12 : t);
  loc_0e74(m);
  assert.equal(m.mem.workRam[0x3d6], 0x05, "store still landed");
  assert.equal(m.cycles, 29, "1-T undercharge shows");
});
