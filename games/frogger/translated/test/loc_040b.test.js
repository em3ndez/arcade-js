// SPDX-License-Identifier: GPL-3.0-only
// loc_040b: board-start / life-loss dispatcher. The continue path delegates into the real sibling
// loc_0457; otherwise the per-board setup runs and resumes the play loop via jp 0x0368.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_040b } from "../loc_040b.js";
import { loc_0457 } from "../loc_0457.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const setA = (v) => (mm) => { bal(mm); mm.regs.a = v; };
const CALLEES = [0x0038, 0x06ee, 0x0b1f, 0x05f0, 0x0942, 0x0a16, 0x07c1, 0x0a48, 0x0368,
  0x0804, 0x07e6, 0x0018, 0x0822];

function mk(over = new Map()) {
  const routines = new Map(CALLEES.map((a) => [a, bal]));
  routines.set(0x0457, loc_0457); // real sibling -- the chain
  routines.set(0x0942, setA(0x77)); // board build leaves A, stored into (0x83ea)
  for (const [a, fn] of over) routines.set(a, fn);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const rd = (m, a) => m.mem.read8(a);
const w = (m, a, v) => m.mem.write8(a, v);

test("loc_040b: continue path (0x83ea set) delegates into loc_0457, back to the play loop", () => {
  const m = mk();
  w(m, 0x83ea, 0x01); // a life remains
  w(m, 0x83ce, 0x00); // loc_0457 finds no life credit -> jp z,0x0368
  loc_040b(m);
  assert.deepEqual(m.calls, [0x0457, 0x0b1f, 0x0368], "real sibling, then the play loop");
  assert.equal(m.pc, 0x0368);
  assert.equal(m.cycles, 71);
});

test("loc_040b: 2P swap pending (0x83cd) skips loc_0422, seeds the HUD, jp 0x0368", () => {
  const m = mk();
  w(m, 0x83ea, 0x00);
  w(m, 0x83cd, 0x05); // swap pending -> jr nz,0x0425
  w(m, 0x826d, 0x00); // no extra-life foreground
  w(m, 0x83fe, 0x01); // 1 player -> no 2P start-flag call
  loc_040b(m);
  assert.deepEqual(m.calls, [0x0942, 0x0a16, 0x0a48, 0x0368]);
  assert.equal(rd(m, 0x83ea), 0x77, "(0x83ea) = A from the board build");
  assert.equal(rd(m, 0x839e), 0x20); assert.equal(rd(m, 0x839d), 0x10); assert.equal(rd(m, 0x839c), 0x20);
  assert.equal(rd(m, 0x826d), 0x00);
  assert.equal(rd(m, 0x83b6), 0x05, "(0x83b6) = (0x83cd)");
  assert.equal(m.pc, 0x0368);
  assert.equal(m.cycles, 275);
});

test("loc_040b: full 2P setup -- bank swap + extra-life + 2P start flags, all taken", () => {
  const m = mk();
  w(m, 0x83ea, 0x00);
  w(m, 0x83cd, 0x00); // no swap pending -> fall through
  w(m, 0x826d, 0x01); // extra-life foreground -> call nz,0x05f0
  w(m, 0x83fe, 0x02); // 2 players -> rst38 + 06ee bank swap, and 07c1 start flags
  loc_040b(m);
  assert.deepEqual(m.calls,
    [0x0038, 0x06ee, 0x0b1f, 0x05f0, 0x0942, 0x0a16, 0x07c1, 0x0a48, 0x0368]);
  assert.equal(rd(m, 0x83ea), 0x77);
  assert.equal(rd(m, 0x826d), 0x00);
  assert.equal(rd(m, 0x83b6), 0x00);
  assert.equal(m.pc, 0x0368);
  assert.equal(m.cycles, 353);
});
