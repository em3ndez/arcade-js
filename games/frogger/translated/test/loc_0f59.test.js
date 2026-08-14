// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0f59 (Frogger game-over / level line, ROM 0x0F59-0x0F68). It clears the
// 0xA850 VRAM row via loc_19e2, then blits 9 tiles via rst 0x28 (loc_0028: DE=src=0x2F0E,
// HL=dst=0xAA70, B=9). Both callees stubbed as SP-balancers that also snapshot their entry registers.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0f59 } from "../loc_0f59.js";

function mk() {
  const seen = {};
  const bal = (key, snap) => (mm) => {
    seen[key] = snap(mm.regs);
    mm.regs.sp = (mm.regs.sp + 2) & 0xffff; // pop the pushed return addr (callee ret)
  };
  const routines = new Map([
    [0x19e2, bal("at19e2", (r) => ({ hl: r.hl }))],
    [0x0028, bal("at0028", (r) => ({ hl: r.hl, de: r.de, b: r.b }))],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.seen = seen;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

function check(m) {
  assert.deepEqual(m.calls, [0x19e2, 0x0028], "loc_19e2 then rst 0x28, in order");
  assert.equal(m.seen.at19e2.hl, 0xa850, "loc_19e2 entered with HL=0xa850 (row to clear)");
  assert.deepEqual(m.seen.at0028, { hl: 0xaa70, de: 0x2f0e, b: 0x09 }, "rst 0x28: dst/src/count");
  assert.equal(m.cycles, 75, "T-states 10+17+10+10+7+11+10");
  assert.equal(m.pc, 0xbeef, "ret to caller");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
}

test("loc_0f59: clears the 0xa850 row then blits 9 tiles from 0x2f0e", () => {
  const m = mk();
  loc_0f59(m);
  check(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0f59.js
//   find: regs.b = 0x09;
//   repl: regs.b = 0x08;
//   expect: FAIL  (rst 0x28 entered with B=8, caught by the b:0x09 assertion in check)
//   verified-anchor: count == 1  (the sole `regs.b = 0x09;` in loc_0f59.js)
// Simulated by presenting B one lower at the 0x0028 dispatch — the state the edit would produce.
test("loc_0f59: the contract catches a wrong blit count", () => {
  const m = mk();
  const oc = m.call.bind(m);
  m.call = (a, ...r) => {
    if (a === 0x0028) m.regs.b = (m.regs.b - 1) & 0xff;
    return oc(a, ...r);
  };
  loc_0f59(m);
  assert.throws(() => check(m));
});
