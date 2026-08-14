// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2673.js (Frogger award-points helper, ROM 0x2673-0x2699). The score-add
// callee loc_08e0 is stubbed (captures DE + balances the pushed return).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2673 } from "../loc_2673.js";

function mk() {
  const routines = new Map();
  routines.set(0x08e0, (mm) => {
    mm.captured = { de: mm.regs.de };
    mm.regs.sp = (mm.regs.sp + 2) & 0xffff; // balance the call's pushed return
  });
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.read8(a);

test("loc_2673: (0x8120)==0 seeds the popup block and adds DE=0x20 via loc_08e0", () => {
  const m = mk();
  m.mem.write8(0x8120, 0x00);
  m.regs.b = 0x42;
  loc_2673(m);
  assert.equal(r(m, 0x805c), 0x42, "(0x805c) = B");
  assert.equal(r(m, 0x805d), 0x19, "(0x805d) = 0x19");
  assert.equal(r(m, 0x805e), 0x03, "(0x805e) = 0x03");
  assert.equal(r(m, 0x805f), 0x20, "(0x805f) = 0x20");
  assert.equal(r(m, 0x8340), 0xa0, "(0x8340) = 0xa0");
  assert.equal(m.captured.de, 0x0020, "DE = the score increment");
  assert.deepEqual(m.calls, [0x08e0], "one score add");
  assert.equal(m.pc, 0xbeef, "ret to the caller");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
});

test("loc_2673: (0x8120)!=0 flags (0x8004)=1 and pops the caller, skipping its remainder", () => {
  const m = mk();
  m.regs.sp = 0x8800; m.push16(0xcafe); m.push16(0xbabe); // caller's caller, then caller's return
  m.mem.write8(0x8120, 0x01);
  loc_2673(m);
  assert.equal(r(m, 0x8004), 0x01, "(0x8004) = 1");
  assert.equal(m.regs.hl, 0xbabe, "pop hl took the caller's return");
  assert.equal(m.pc, 0xcafe, "ret went to the caller's caller");
  assert.equal(m.regs.sp, 0x8800, "both slots popped");
  assert.deepEqual(m.calls, [], "no score add");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2673.js
//   find: mem.write8(regs.hl, 0x19);
//   repl: mem.write8(regs.hl, 0x18);
//   expect: FAIL  ((0x805d) = 0x18, caught by the seed check)
//   verified-anchor: count == 1  (the sole 0x19 store in loc_2673.js)
// Simulated by intercepting the 0x19 store, which is what the edit produces.
test("loc_2673: the seed check catches a wrong popup byte", () => {
  const m = mk();
  m.mem.write8(0x8120, 0x00);
  m.regs.b = 0x42;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, v === 0x19 ? 0x18 : v, o);
  loc_2673(m);
  assert.throws(() => assert.equal(r(m, 0x805d), 0x19));
});
