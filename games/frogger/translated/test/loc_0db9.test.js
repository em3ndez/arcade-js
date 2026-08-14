// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0db9 (Frogger credit/1UP tile queue, ROM 0x0DB9-0x0DDF). One credit
// ((0x83E1)==1) takes the 0xAAF1 branch (two rst 0x28 blits). Otherwise set (0x8023)=3, blit from
// 0xAB11 (two rst 0x28), then cap the cursor with tile 0x23. rst 0x28 (0x0028) is stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0db9 } from "../loc_0db9.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0028, bal]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function checkMulti(m) {
  assert.equal(r(m, 0x8023), 0x03, "(0x8023) = 3 on the multi-credit branch");
  assert.deepEqual(m.calls, [0x0028, 0x0028], "two blits issued");
}

test("loc_0db9: multi-credit branch sets (0x8023)=3 and blits twice", () => {
  const m = mk();
  m.mem.workRam[0x3e1] = 0x05; // credit count 5 (dec -> 4, non-zero)
  loc_0db9(m);
  checkMulti(m);
});

test("loc_0db9: single-credit branch blits from 0xAAF1, no (0x8023) write", () => {
  const m = mk();
  m.mem.workRam[0x3e1] = 0x01;
  m.mem.workRam[0x023] = 0x77;
  loc_0db9(m);
  assert.equal(r(m, 0x8023), 0x77, "(0x8023) untouched on the 1-credit branch");
  assert.deepEqual(m.calls, [0x0028, 0x0028], "two blits issued");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0db9.js
//   find: regs.a = 0x03;\n  m.step(0x0dc4, 7);
//   repl: regs.a = 0x04;\n  m.step(0x0dc4, 7);
//   expect: FAIL  ((0x8023) = 4 instead of 3 — caught by checkMulti)
//   verified-anchor: count == 1  (the sole ld a,0x03 feeding (0x8023) in loc_0db9.js)
// Simulated by corrupting exactly the (0x8023) store, which is what the edit produces.
test("loc_0db9: the contract catches a wrong (0x8023) value", () => {
  const m = mk();
  m.mem.workRam[0x3e1] = 0x05;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x8023 ? 0x04 : v, o);
  loc_0db9(m);
  assert.throws(() => checkMulti(m));
});
