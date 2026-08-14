// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2856 (ROM 0x2856-0x286C). Gated on (0x83FE)==2: when equal it zeroes the
// five dive-state bytes (0x814F)(0x814E)(0x8145)(0x8146)(0x8147); otherwise it returns untouched.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2856 } from "../loc_2856.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const set = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };
const CELLS = [0x814f, 0x814e, 0x8145, 0x8146, 0x8147];

function prefill(m) {
  for (const a of CELLS) set(m, a, 0xaa);
}

test("loc_2856: (0x83FE)==2 zeroes the five dive-state bytes and returns", () => {
  const m = mk();
  set(m, 0x83fe, 0x02);
  prefill(m);
  loc_2856(m);
  for (const a of CELLS) assert.equal(r(m, a), 0x00, `${a.toString(16)} cleared`);
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.deepEqual(m.calls, [], "leaf: no calls");
});

test("loc_2856: (0x83FE)!=2 returns without touching the block; 31 T", () => {
  const m = mk();
  set(m, 0x83fe, 0x01);
  prefill(m);
  loc_2856(m);
  for (const a of CELLS) assert.equal(r(m, a), 0xaa, `${a.toString(16)} untouched`);
  assert.equal(m.cycles, 31, "ld a,(nn)13 + cp 7 + ret nz taken 11");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2856.js
//   find: mem.write8(0x814f, regs.a);
//   repl: mem.write8(0x815f, regs.a);   // one operand nibble: 4f -> 5f
//   expect: FAIL  (0x814F never cleared)
//   verified-anchor: count == 1  (the sole write to 0x814f in loc_2856.js)
// Simulated by redirecting the 0x814f store to 0x815f, which is what the edit produces.
test("loc_2856: the contract catches a redirected first store", () => {
  const m = mk();
  set(m, 0x83fe, 0x02);
  prefill(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x814f ? 0x815f : a, v, o);
  loc_2856(m);
  assert.throws(() => assert.equal(r(m, 0x814f), 0x00));
});
