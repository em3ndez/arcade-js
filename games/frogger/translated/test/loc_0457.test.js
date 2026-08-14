// SPDX-License-Identifier: GPL-3.0-only
// loc_0457: continue / next-life path. No life credit -> jp z,0x0368; else clear the HUD slots,
// enqueue the start jingle, and take the real sibling loc_048f (0x83cf set) or resume via jp 0x0368.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0457 } from "../loc_0457.js";
import { loc_048f } from "../loc_048f.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const CALLEES = [0x0b1f, 0x0804, 0x07e6, 0x0018, 0x0822, 0x0368, 0x0f59, 0x0547, 0x04f3, 0x0534, 0x0038];

function mk() {
  const routines = new Map(CALLEES.map((a) => [a, bal]));
  routines.set(0x048f, loc_048f); // real sibling -- the chain
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

test("loc_0457: no life credit (0x83ce=0) returns to the play loop", () => {
  const m = mk();
  w(m, 0x83ce, 0x00);
  loc_0457(m);
  assert.deepEqual(m.calls, [0x0b1f, 0x0368]);
  assert.equal(m.pc, 0x0368);
  assert.equal(m.cycles, 44);
});

test("loc_0457: life remains, no intro timer (0x83cf=0) -> resume via 0x0822 + jp 0x0368", () => {
  const m = mk();
  w(m, 0x83ce, 0x01);
  w(m, 0x83cf, 0x00);
  w(m, 0x83a0, 0xff); w(m, 0x83ad, 0xff); // ldir must clear the whole block
  loc_0457(m);
  assert.deepEqual(m.calls, [0x0b1f, 0x0804, 0x07e6, 0x0018, 0x0822, 0x0368]);
  assert.equal(rd(m, 0x839a), 0x00); assert.equal(rd(m, 0x839b), 0x00);
  assert.equal(rd(m, 0x83cc), 0x00); assert.equal(rd(m, 0x83ea), 0x00);
  assert.equal(rd(m, 0x83a0), 0x00); assert.equal(rd(m, 0x83ad), 0x00);
  assert.equal(m.pc, 0x0368);
  assert.equal(m.cycles, 510);
});

test("loc_0457: intro timer set (0x83cf) delegates into loc_048f, reaching cold-start 0x0547", () => {
  const m = mk();
  w(m, 0x83ce, 0x01);
  w(m, 0x83cf, 0x01);
  m.mem.write16(0x83c5, 0x0001); // loc_048f countdown: one pass
  w(m, 0x83fe, 0x01);            // then cold start -> jp z,0x0547
  loc_0457(m);
  assert.deepEqual(m.calls,
    [0x0b1f, 0x0804, 0x07e6, 0x0018, 0x048f, 0x0f59, 0x0018, 0x0018, 0x0547]);
  assert.equal(m.pc, 0x0547);
  assert.equal(m.cycles, 621);
});
