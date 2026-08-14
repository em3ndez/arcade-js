// SPDX-License-Identifier: GPL-3.0-only
// loc_0341: the main/attract loop. `call nc,0x0d11` only fires when mode (0x83D6) >= 2; the per-pass
// workers (0x0b1f/0x0b67/0x230f) always run; (0x83FE) set jumps to the in-play entry loc_040b.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0341 } from "../loc_0341.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const CALLEES = [0x0d11, 0x0b1f, 0x0b67, 0x230f, 0x0b0a, 0x07d9, 0x07e6, 0x223d, 0x040b];

function mk() {
  const routines = new Map(CALLEES.map((a) => [a, bal]));
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  m.mem.workRam[0x3fe] = 1; // a game in progress -> jp nz,0x040b ends the pass
  return m;
}

test("loc_0341: mode < 2 skips the 0x0d11 dispatcher, runs the workers, delegates to loc_040b", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x00; // attract mode at cold boot
  loc_0341(m);
  assert.deepEqual(m.calls, [0x0b1f, 0x0b67, 0x230f, 0x040b], "no 0x0d11 at mode 0");
  assert.equal(m.pc, 0x040b, "delegated to the in-play entry");
});

test("loc_0341: mode >= 2 calls the 0x0d11 attract dispatcher first", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x02;
  loc_0341(m);
  assert.deepEqual(m.calls, [0x0d11, 0x0b1f, 0x0b67, 0x230f, 0x040b], "0x0d11 leads the pass");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0341.js
//   find: m.step(0x0346, 7);
//   repl: m.step(0x0346, 6);
//   expect: FAIL (undercharges the cp 0x02 gating 0x0d11; the call decision is identical, cycles move)
//   verified-anchor: count == 1
test("loc_0341: the cycle total catches a mistimed mode compare", () => {
  const m = mk();
  m.mem.workRam[0x3d6] = 0x00;
  const os = m.step.bind(m);
  let clean; { const c = mk(); c.mem.workRam[0x3d6] = 0x00; loc_0341(c); clean = c.cycles; }
  m.step = (a, t) => os(a, a === 0x0346 && t === 7 ? 6 : t);
  loc_0341(m);
  assert.deepEqual(m.calls, [0x0b1f, 0x0b67, 0x230f, 0x040b], "call decision unchanged");
  assert.equal(m.cycles, clean - 1, "1-T undercharge shows");
});
