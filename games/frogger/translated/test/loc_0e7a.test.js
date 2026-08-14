// SPDX-License-Identifier: GPL-3.0-only
// loc_0e7a: the attract sequencer + its cracked jp(hl) animator. Phase 0 seeds the demo; phase 1
// dispatches on (0x83D7) through the 0x0EC3 jr-trampoline (HL = 0x0EC1 + 2*phase); credits present
// tail-jumps to loc_0e74.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0e7a } from "../loc_0e7a.js";
import { loc_0e74 } from "../loc_0e74.js";

function mk(routines = new Map()) {
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0x012e);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const w = (m, a) => m.mem.workRam[a - 0x8000];
const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

test("loc_0e7a: phase 0 seeds the demo (calls 0x0766/0x064b, arms the animator); 558 T", () => {
  const m = mk(new Map([[0x0766, bal], [0x064b, bal]]));
  m.mem.workRam[0x3e1] = 0; m.mem.workRam[0x3bf] = 0;
  loc_0e7a(m);
  assert.deepEqual(m.calls, [0x0766, 0x064b], "the two seed routines, in order");
  assert.equal(w(m, 0x83bf), 1, "phase advanced 0 -> 1");
  assert.equal(w(m, 0x83d7), 7, "phase counter armed to 7");
  assert.equal(w(m, 0x83bc), 0x20, "(0x83bc) seeded");
  assert.equal(w(m, 0x83bd), 0x04, "frame timer seeded");
  assert.equal(w(m, 0x83be), 0x05, "frame index seeded");
  assert.equal(w(m, 0x8043), 0x81, "cell 0 laid out (D=0x81)");
  assert.equal(m.pc, 0x012e, "returned to caller");
  assert.equal(m.cycles, 558, "phase-0 T total");
});

test("loc_0e7a: phase 1 (0x83D7)=7 dispatches through jp(hl) to the 0x8040 cell arm; 248 T", () => {
  // stub loc_0f3e as the normal return with tile 5 in A
  const m = mk(new Map([[0x0f3e, (mm) => { bal(mm); mm.regs.a = 0x05; return true; }]]));
  m.mem.workRam[0x3e1] = 0; m.mem.workRam[0x3bf] = 1; m.mem.workRam[0x3d7] = 7;
  m.mem.workRam[0x040] = 0x40;
  loc_0e7a(m);
  assert.deepEqual(m.calls, [0x0f3e], "the phase-7 arm ran the frame clock");
  assert.equal(w(m, 0x8040), 0x3c, "0x8040 cell scrolled -4 (0x40 -> 0x3c)");
  assert.equal(w(m, 0x8041), 0x05, "the frame tile written to the cell");
  assert.equal(m.cycles, 248, "phase-1 dispatch T total");
});

test("loc_0e7a: credits present tail-jumps to loc_0e74; 59 T", () => {
  const m = mk(new Map([[0x0e74, loc_0e74]]));
  m.mem.workRam[0x3e1] = 0x01; // a credit
  loc_0e7a(m);
  assert.deepEqual(m.calls, [0x0e74], "delegated to loc_0e74");
  assert.equal(w(m, 0x83d6), 0x05, "loc_0e74 forced attract mode");
  assert.equal(m.pc, 0x012e, "loc_0e74's ret returned to loc_0e7a's caller");
  assert.equal(m.cycles, 59, "credits-tail T total");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0e7a.js
//   find: m.step(0x0ec2, 11); // HL = 0x0ec1 + 2*phase -- the jr-trampoline slot
//   repl: m.step(0x0ec2, 10);
//   expect: FAIL (undercharges the add hl,de feeding jp(hl); dispatch state identical, cycles move)
//   verified-anchor: count == 1
test("loc_0e7a: the cycle total catches a mistimed dispatch index add", () => {
  const m = mk(new Map([[0x0f3e, (mm) => { bal(mm); mm.regs.a = 0x05; return true; }]]));
  m.mem.workRam[0x3bf] = 1; m.mem.workRam[0x3d7] = 7; m.mem.workRam[0x040] = 0x40;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0ec2 && t === 11 ? 10 : t);
  loc_0e7a(m);
  assert.equal(w(m, 0x8040), 0x3c, "dispatch unchanged by the timing mutation");
  assert.equal(m.cycles, 247, "1-T undercharge shows");
});
