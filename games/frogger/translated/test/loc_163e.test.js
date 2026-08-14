// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_163e.js (Frogger object mover-LEFT engine, ROM 0x163E-0x16F7) and its
// mover-RIGHT phase-pending tail export loc_16d4. Transfers out (loc_14b7/loc_15ab/loc_15de) are
// jumps and are stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_163e, loc_16d4 } from "../loc_163e.js";

function mk() {
  const routines = new Map();
  for (const a of [0x14b7, 0x15ab, 0x15de]) routines.set(a, () => {});
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.read8(a);

// loc_163e: phase 0, bit4 clear -> subtract-C shift of a 2-entry run + lead sprite; frog X above the
// lane window (>= 0x73) takes the short exit that clears the phase and advances the index.
function setupShift(m) {
  m.regs.iy = 0x8100; m.mem.write8(0x8100, 0x00); // phase 0
  m.regs.hl = 0x8101; m.mem.write8(0x8101, 0x03); // low nibble 3 = shift, bit4 clear
  m.regs.de = 0x8200;
  m.mem.write8(0x8200, 0x02); // run length (count), NOT shifted
  m.mem.write8(0x8201, 0x20); m.mem.write8(0x8202, 0x30);
  m.regs.ix = 0x8210;
  m.mem.write8(0x8210, 0x40); m.mem.write8(0x8211, 0xaa); m.mem.write8(0x8212, 0x50);
  m.mem.write8(0x8047, 0x80); // frog X above the lane window -> short exit
  m.mem.write8(0x80ff, 0x05); // object index
}

test("loc_163e: subtracts C from the run + lead sprite, clears the phase, advances the index", () => {
  const m = mk();
  setupShift(m);
  loc_163e(m);
  assert.equal(r(m, 0x8200), 0x02, "count byte untouched");
  assert.equal(r(m, 0x8201), 0x1d, "run[1] -= C");
  assert.equal(r(m, 0x8202), 0x2d, "run[2] -= C");
  assert.equal(r(m, 0x8210), 0x3d, "(ix+0) = lead X - C");
  assert.equal(r(m, 0x8211), 0xaa, "(ix+1) untouched");
  assert.equal(r(m, 0x8212), 0x3d, "(ix+2) = the same lead X - C");
  assert.equal(r(m, 0x8100), 0x00, "phase cleared");
  assert.equal(r(m, 0x80ff), 0x06, "index incremented");
  assert.deepEqual(m.calls, [0x14b7], "more objects -> loc_14b7");
});

test("loc_163e: phase byte non-zero hands to the interior pending path (jp 0x1651 tail)", () => {
  const m = mk();
  setupShift(m);
  m.mem.write8(0x8100, 0x01); // phase == 1 -> b_16e6 forces C=1 and jumps to the shift
  loc_163e(m);
  // C forced to 1, so the run/lead shift by 1; index still advances, tails loc_14b7
  assert.equal(r(m, 0x8201), 0x1f, "run[1] -= 1");
  assert.equal(r(m, 0x8210), 0x3f, "(ix+0) = lead X - 1");
  assert.equal(r(m, 0x8100), 0x00, "phase cleared after the forced step");
  assert.deepEqual(m.calls, [0x14b7]);
});

test("loc_16d4: C==1 forces a one-step move and re-enters loc_15ab", () => {
  const m = mk();
  m.regs.iy = 0x8100; m.regs.c = 0x01;
  loc_16d4(m);
  assert.equal(m.regs.c, 0x01, "C held at 1");
  assert.deepEqual(m.calls, [0x15ab], "re-enter the +C shift tail");
});

test("loc_16d4: C>1 decrements the phase, stores it, and re-enters loc_15de", () => {
  const m = mk();
  m.regs.iy = 0x8100; m.regs.c = 0x05;
  loc_16d4(m);
  assert.equal(m.regs.c, 0x04, "phase decremented");
  assert.equal(r(m, 0x8100), 0x04, "phase written back to (iy+0)");
  assert.deepEqual(m.calls, [0x15de], "skip the move this frame");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_163e.js
//   find: mem.write8((regs.ix + 2) & 0xffff, regs.a);
//   repl: mem.write8((regs.ix + 1) & 0xffff, regs.a);
//   expect: FAIL  ((ix+2) never gets the shifted X, caught by the shift check)
//   verified-anchor: count == 1  (the sole (ix+2) store in loc_163e.js)
// Simulated by redirecting the 0x8212 store to 0x8211, which is what the +2 -> +1 edit produces.
test("loc_163e: the shift check catches a mis-addressed lead-sprite store", () => {
  const m = mk();
  setupShift(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x8212 ? 0x8211 : a, v, o);
  loc_163e(m);
  assert.throws(() => assert.equal(r(m, 0x8212), 0x3d));
});
