// SPDX-License-Identifier: GPL-3.0-only
// loc_0f3e: the attract animator's per-cell frame clock. The 0x0F56 arm is a DOUBLE caller-skip —
// it pops its own frame AND the arm's return, ret'ing straight to loc_0e7a's caller (returns false).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0f3e } from "../loc_0f3e.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800;
  return m;
}

test("loc_0f3e: timer not elapsed -> 0x0F56 double-skip rets to loc_0e7a's caller (false); 74 T", () => {
  const m = mk();
  m.push16(0x012e); // loc_0e7a's return address
  m.push16(0x0f01); // the arm's return address
  m.regs.hl = 0x8040;
  m.mem.workRam[0x3bd] = 3;
  const ret = loc_0f3e(m);
  assert.equal(ret, false, "signals the skip-out to loc_0e7a");
  assert.equal(m.pc, 0x012e, "ret'd past the arm, to loc_0e7a's caller");
  assert.equal(m.regs.sp, 0x8800, "both returns popped, SP balanced");
  assert.equal(m.mem.workRam[0x3bd], 2, "timer decremented");
  assert.equal(m.cycles, 74, "skip-path T total");
});

test("loc_0f3e: timer elapsed -> reload, advance frame, return the table tile (true); 128 T", () => {
  const m = mk();
  m.push16(0x0f01); // only the arm's return: normal ret goes here
  m.regs.hl = 0x8040;
  m.mem.workRam[0x3bd] = 1; m.mem.workRam[0x3be] = 2;
  const ret = loc_0f3e(m);
  assert.equal(ret, true, "normal return to the arm");
  assert.equal(m.pc, 0x0f01, "ret'd to the arm");
  assert.equal(m.mem.workRam[0x3bd], 0x08, "timer reloaded");
  assert.equal(m.mem.workRam[0x3be], 1, "frame index advanced");
  assert.equal(m.regs.hl, 0x8040, "caller's HL restored");
  assert.equal(m.cycles, 128, "normal-path T total");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0f3e.js
//   find: m.step(0x0f43, 11); // dec (0x83bd) -- the per-cell frame timer
//   repl: m.step(0x0f43, 10);
//   expect: FAIL (undercharges the dec (hl) by 1 T; the double-skip still lands, only cycles move)
//   verified-anchor: count == 1
test("loc_0f3e: the cycle total catches a mistimed timer decrement", () => {
  const m = mk();
  m.push16(0x012e); m.push16(0x0f01); m.regs.hl = 0x8040; m.mem.workRam[0x3bd] = 3;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0f43 && t === 11 ? 10 : t);
  loc_0f3e(m);
  assert.equal(m.pc, 0x012e, "control flow unchanged by the timing mutation");
  assert.equal(m.cycles, 73, "1-T undercharge shows");
});
