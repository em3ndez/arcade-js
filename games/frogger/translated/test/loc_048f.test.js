// SPDX-License-Identifier: GPL-3.0-only
// loc_048f: intro countdown ((0x83c5) -> 0) then a 3-way new-game branch (0x0547 / 0x04f3 / 0x0534),
// else seed player 1's work RAM (0x8600->0x80ff, 0x85c0->0x800c) and resume via jp 0x0368.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_048f } from "../loc_048f.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const CALLEES = [0x0f59, 0x0018, 0x0038, 0x0822, 0x0547, 0x04f3, 0x0534, 0x0368];

function mk() {
  const routines = new Map(CALLEES.map((a) => [a, bal]));
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  m.mem.write16(0x83c5, 0x0003); // countdown: three passes
  return m;
}
const rd = (m, a) => m.mem.read8(a);
const w = (m, a, v) => m.mem.write8(a, v);

test("loc_048f: cold start (0x83fe=1) counts down then jp z,0x0547", () => {
  const m = mk();
  w(m, 0x83fe, 0x01);
  loc_048f(m);
  assert.deepEqual(m.calls, [0x0f59, 0x0018, 0x0018, 0x0547]);
  assert.equal(m.mem.read16(0x83c5), 0x0000, "countdown reached 0");
  assert.equal(m.pc, 0x0547);
  assert.equal(m.cycles, 217);
});

test("loc_048f: 2P continue (0x83fe=2, 0x83fd=2) -> jp nz,0x04f3", () => {
  const m = mk();
  w(m, 0x83fe, 0x02); w(m, 0x83fd, 0x02);
  loc_048f(m);
  assert.deepEqual(m.calls, [0x0f59, 0x0018, 0x0018, 0x04f3]);
  assert.equal(m.pc, 0x04f3);
  assert.equal(m.cycles, 244);
});

test("loc_048f: P1-only pre-clear (0x83fe=2, 0x83fd=1, 0x83ca!=0) -> jp nz,0x0534", () => {
  const m = mk();
  w(m, 0x83fe, 0x02); w(m, 0x83fd, 0x01); w(m, 0x83ca, 0x09);
  loc_048f(m);
  assert.deepEqual(m.calls, [0x0f59, 0x0018, 0x0018, 0x0534]);
  assert.equal(rd(m, 0x83c9), 0x01);
  assert.equal(m.pc, 0x0534);
  assert.equal(m.cycles, 291);
});

test("loc_048f: full new-game seed (0x83ca=0) copies the P1 banks and jp 0x0368", () => {
  const m = mk();
  w(m, 0x83fe, 0x02); w(m, 0x83fd, 0x01); w(m, 0x83ca, 0x00);
  w(m, 0x8600, 0xaa); w(m, 0x86b6, 0xbb); w(m, 0x85c0, 0xcc); // source markers
  loc_048f(m);
  assert.deepEqual(m.calls, [0x0f59, 0x0018, 0x0018, 0x0038, 0x0822, 0x0368]);
  assert.equal(rd(m, 0x83c9), 0x01);
  assert.equal(rd(m, 0x83fe), 0x01); assert.equal(rd(m, 0x825c), 0x01);
  assert.equal(rd(m, 0x825e), 0x00); assert.equal(rd(m, 0x8262), 0x00);
  assert.equal(rd(m, 0x80ff), 0xaa); assert.equal(rd(m, 0x81b5), 0xbb);
  assert.equal(rd(m, 0x800c), 0xcc);
  assert.equal(rd(m, 0x803f), 0x01);
  assert.equal(m.pc, 0x0368);
  assert.equal(m.cycles, 5297);
});
