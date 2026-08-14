// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter + mutation test for loc_0c3d (Frogger intro digit helper, ROM 0x0C3D-0x0C49): BC = the
// (0x83FB) digit pair, DE = row-base 0x30 / tile 0x04, then draw via loc_0c4a TWICE — an explicit
// `call 0x0c4a` (C = low digit) then a FALL-THROUGH with C=B (high digit). loc_0c4a is stubbed as a
// balanced pop-return recording its entry (H,D,E,C,B); loc_0c3d's own instructions cost 58 T.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0c3d } from "../loc_0c3d.js";

function mk() {
  const captures = [];
  const routines = new Map();
  routines.set(0x0c4a, (mm) => {
    const { regs } = mm;
    captures.push({ h: regs.h, d: regs.d, e: regs.e, c: regs.c, b: regs.b });
    mm.regs.sp = (mm.regs.sp + 2) & 0xffff; // balance the CALL's push (loc_0c4a's ret)
  });
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xdead); // simulate loc_0c3d having been CALLed (fake caller return)
  m.mem.write8(0x83fb, 0x2c); // low digit -> C
  m.mem.write8(0x83fc, 0x2b); // high digit -> B
  m.captures = captures;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

function check(m) {
  assert.equal(m.cycles, 58, "T-state total of loc_0c3d's own instructions (7+20+10+17+4)");
  assert.deepEqual(m.calls, [0x0c4a, 0x0c4a], "loc_0c4a drawn TWICE (explicit call + fall-through)");
  assert.equal(m.regs.sp, 0x8800, "both loc_0c4a returns balanced -> SP back above the caller slot");
  assert.equal(m.mem.read16(0x87fc), 0x0c49, "CALL pushed the correct return address 0x0c49");
  assert.deepEqual(m.captures[0], { h: 0x80, d: 0x30, e: 0x04, c: 0x2c, b: 0x2b },
    "pass 1: C = the low digit (0x2c)");
  assert.deepEqual(m.captures[1], { h: 0x80, d: 0x30, e: 0x04, c: 0x2b, b: 0x2b },
    "pass 2: ld c,b put the high digit (0x2b) into C");
}

test("loc_0c3d: loads the digit pair and draws both via loc_0c4a (twice); 58 T", () => {
  const m = mk();
  loc_0c3d(m);
  check(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0c3d.js
//   find: m.push16(0x0c49);
//   repl: m.push16(0x0c48);
//   expect: FAIL  (CALL pushes the wrong return address -> stacked word is 0x0c48, not 0x0c49)
//   verified-anchor: count == 1  (the sole m.push16 in loc_0c3d.js)
// Flipping the one 0x49 byte push16 writes to 0x48 is exactly what that edit produces.
test("loc_0c3d: the contract catches a wrong CALL return address", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, bo) => ow(a, v === 0x49 ? 0x48 : v, bo);
  loc_0c3d(m);
  assert.throws(() => check(m), /return address/);
});
