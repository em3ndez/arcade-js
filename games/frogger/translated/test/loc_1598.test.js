// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1598.js (Frogger object mover-RIGHT engine, ROM 0x1598-0x163D) and its two
// shared continue-tail exports loc_15ab (apply the +C shift) and loc_15de (advance the object index).
// All transfers out (loc_16d4/loc_15ab/loc_15de/loc_14b7) are jumps and are stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1598, loc_15ab, loc_15de } from "../loc_1598.js";

function mk() {
  const routines = new Map();
  for (const a of [0x16d4, 0x15ab, 0x15de, 0x14b7]) routines.set(a, () => {});
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.read8(a);

test("loc_1598: phase byte non-zero hands straight to the mover-LEFT tail loc_16d4; 37 T", () => {
  const m = mk();
  m.regs.iy = 0x8100;
  m.mem.write8(0x8100, 0x07);
  loc_1598(m);
  assert.equal(m.regs.c, 0x07, "C = phase byte");
  assert.deepEqual(m.calls, [0x16d4], "delegate to loc_16d4");
  assert.equal(m.cycles, 37, "ld a,(iy+0) 19 + ld c,a 4 + and a 4 + jp nz taken 10");
});

test("loc_1598: phase 0 with the lane 'phase set' bit (0x10) also goes to loc_16d4", () => {
  const m = mk();
  m.regs.iy = 0x8100; m.mem.write8(0x8100, 0x00);
  m.regs.hl = 0x8101; m.mem.write8(0x8101, 0x1a); // low nibble 0x0a, bit4 set
  loc_1598(m);
  assert.equal(m.regs.c, 0x0a, "C = lane low nibble (shift amount)");
  assert.deepEqual(m.calls, [0x16d4], "bit4 set -> loc_16d4");
});

test("loc_1598: phase 0 with bit4 clear falls into the +C shift tail loc_15ab", () => {
  const m = mk();
  m.regs.iy = 0x8100; m.mem.write8(0x8100, 0x00);
  m.regs.hl = 0x8101; m.mem.write8(0x8101, 0x05); // low nibble 5, bit4 clear
  loc_1598(m);
  assert.equal(m.regs.c, 0x05, "C = shift amount");
  assert.deepEqual(m.calls, [0x15ab], "bit4 clear -> loc_15ab");
});

// loc_15ab: shift a 3-entry object run + its lead sprite right by C, then (frog X < 0x30) take the
// short exit that clears the phase and falls into loc_15de.
function setupShift(m) {
  m.regs.iy = 0x8100; m.mem.write8(0x8100, 0x05); // phase, cleared by the short exit
  m.regs.de = 0x8200;
  m.mem.write8(0x8200, 0x03); // run length (count), NOT shifted
  m.mem.write8(0x8201, 0x10); m.mem.write8(0x8202, 0x20); m.mem.write8(0x8203, 0x30);
  m.regs.ix = 0x8210;
  m.mem.write8(0x8210, 0x40); m.mem.write8(0x8211, 0xaa); m.mem.write8(0x8212, 0x50);
  m.regs.c = 0x02; // shift amount
  m.mem.write8(0x8047, 0x10); // frog X below the lane window -> short exit
}

test("loc_15ab: adds C to the run bytes + lead sprite, clears the phase, tails loc_15de", () => {
  const m = mk();
  setupShift(m);
  loc_15ab(m);
  assert.equal(r(m, 0x8200), 0x03, "count byte untouched");
  assert.equal(r(m, 0x8201), 0x12, "run[1] += C");
  assert.equal(r(m, 0x8202), 0x22, "run[2] += C");
  assert.equal(r(m, 0x8203), 0x32, "run[3] += C");
  assert.equal(r(m, 0x8210), 0x42, "(ix+0) = lead X + C");
  assert.equal(r(m, 0x8211), 0xaa, "(ix+1) untouched");
  assert.equal(r(m, 0x8212), 0x42, "(ix+2) = the same lead X + C");
  assert.equal(r(m, 0x8100), 0x00, "phase cleared");
  assert.deepEqual(m.calls, [0x15de], "advance the index next");
});

test("loc_15de: index < 0x0B loops back into the dispatcher loc_14b7", () => {
  const m = mk();
  m.mem.write8(0x80ff, 0x05);
  loc_15de(m);
  assert.equal(r(m, 0x80ff), 0x06, "index incremented");
  assert.deepEqual(m.calls, [0x14b7], "more objects -> loc_14b7");
});

test("loc_15de: index reaching 0x0B wraps to 0 and returns", () => {
  const m = mk();
  m.mem.write8(0x80ff, 0x0a);
  loc_15de(m);
  assert.equal(r(m, 0x80ff), 0x00, "index wrapped");
  assert.deepEqual(m.calls, [], "no dispatch");
  assert.equal(m.pc, 0xbeef, "ret to the caller");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1598.js
//   find: mem.write8((regs.ix + 2) & 0xffff, regs.a);
//   repl: mem.write8((regs.ix + 1) & 0xffff, regs.a);
//   expect: FAIL  ((ix+2) never gets the shifted X, caught by the loc_15ab shift check)
//   verified-anchor: count == 1  (the sole (ix+2) store in loc_1598.js)
// Simulated by redirecting the 0x8212 store to 0x8211, which is what the +2 -> +1 edit produces.
test("loc_15ab: the shift check catches a mis-addressed lead-sprite store", () => {
  const m = mk();
  setupShift(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x8212 ? 0x8211 : a, v, o);
  loc_15ab(m);
  assert.throws(() => assert.equal(r(m, 0x8212), 0x42));
});
