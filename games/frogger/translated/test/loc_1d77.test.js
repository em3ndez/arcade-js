// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for the home-row goal handlers row-0 (loc_1d77) and row-1 (loc_1d87), ROM
// 0x1D77-0x1DD7. Both tail into the input scanner loc_1acb; loc_1d87 also calls the bonus
// award (0x2673), the home-slot fill (0x1f1c) and 0x27cb. All four external transfers are
// stubbed with an SP-balancer. loc_1d87 selects the per-frog counter from 0x83fd (825e vs 8263).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1d77, loc_1d87 } from "../loc_1d77.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const STUBS = [0x1d77, 0x1d87, 0x1acb, 0x2673, 0x1f1c, 0x27cb];

function mk(...real) {
  const routines = new Map(STUBS.map((a) => [a, bal]));
  for (const [a, fn] of real) routines.set(a, fn);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...rest) => { m.calls.push(a); return oc(a, ...rest); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_1d77: frog reached row 0 -> sets 0x8004, tails into loc_1acb", () => {
  const m = mk([0x1d77, loc_1d77]);
  m.mem.workRam[0x047] = 0x00; // frog Y < 0x2a
  loc_1d77(m);
  assert.equal(r(m, 0x8004), 0x01);
  assert.deepEqual(m.calls, [0x1acb]);
});

test("loc_1d77: frog Y >= 0x2a -> straight to loc_1acb, no write; 30 T", () => {
  const m = mk([0x1d77, loc_1d77]);
  m.mem.workRam[0x047] = 0x40;
  loc_1d77(m);
  assert.equal(r(m, 0x8004), 0x00, "no 0x8004 write on the jp nc path");
  assert.equal(m.cycles, 30, "ld a,(nn)13 + cp 7 + jp nc taken 10");
  assert.deepEqual(m.calls, [0x1acb]);
});

test("loc_1d87: frog-1 goal -> bonus + fill, marks 0x825e, steps 0x825c", () => {
  const m = mk([0x1d87, loc_1d87]);
  m.mem.workRam[0x3fd] = 0x01; // 0x83fd = 1 -> frog-1 slot (825e)
  m.mem.workRam[0x25e] = 0x00; // not yet awarded
  m.mem.workRam[0x047] = 0x00; // frog Y < 0x2a
  m.mem.workRam[0x121] = 0x01; // 0x8121 == 1 -> call z,0x2673 taken
  m.mem.workRam[0x134] = 0x00; // 0x8134 clear -> skip 0x27cb
  loc_1d87(m);
  assert.equal(r(m, 0x825e), 0x01, "0x825e marked awarded");
  assert.equal(r(m, 0x825c), 0x01, "0x825c incremented");
  assert.deepEqual(m.calls, [0x2673, 0x1f1c]);
});

test("loc_1d87: 0x8134 set also calls 0x27cb and clears it", () => {
  const m = mk([0x1d87, loc_1d87]);
  m.mem.workRam[0x3fd] = 0x01;
  m.mem.workRam[0x25e] = 0x00;
  m.mem.workRam[0x047] = 0x00;
  m.mem.workRam[0x121] = 0x05; // != 1 -> no bonus
  m.mem.workRam[0x134] = 0x01; // set -> 0x27cb branch
  loc_1d87(m);
  assert.equal(r(m, 0x8134), 0x00, "0x8134 cleared");
  assert.deepEqual(m.calls, [0x1f1c, 0x27cb]);
});

test("loc_1d87: 0x83fd != 1 selects the frog-2 slot (8263 / 825d)", () => {
  const m = mk([0x1d87, loc_1d87]);
  m.mem.workRam[0x3fd] = 0x02; // dec -> 1 -> frog-2 slot (8263)
  m.mem.workRam[0x263] = 0x00; // not yet awarded
  m.mem.workRam[0x047] = 0x00;
  m.mem.workRam[0x121] = 0x05; // no bonus
  m.mem.workRam[0x134] = 0x00; // skip 0x27cb
  loc_1d87(m);
  assert.equal(r(m, 0x8263), 0x01, "0x8263 marked awarded");
  assert.equal(r(m, 0x825d), 0x01, "0x825d incremented");
  assert.deepEqual(m.calls, [0x1f1c]);
});

test("loc_1d87: already-awarded (825e != 0) rets without awarding", () => {
  const m = mk([0x1d87, loc_1d87]);
  m.mem.workRam[0x3fd] = 0x01;
  m.mem.workRam[0x25e] = 0x01; // already done
  loc_1d87(m);
  assert.deepEqual(m.calls, [], "no fill / bonus");
  assert.equal(r(m, 0x825c), 0x00, "counter untouched");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1d77.js
//   find: mem.write8(0x8004, regs.a);
//   repl: mem.write8(0x8005, regs.a);
//   expect: FAIL  (row-0 goal flag lands at 0x8005, so 0x8004 stays 0)
//   verified-anchor: count == 1  (the sole ld (0x8004),a in loc_1d77.js)
// Simulated by redirecting the 0x8004 store to 0x8005, which is what the edit produces.
test("loc_1d77: the contract catches a mis-targeted goal-flag store", () => {
  const m = mk([0x1d77, loc_1d77]);
  m.mem.workRam[0x047] = 0x00;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a === 0x8004 ? 0x8005 : a, val, o);
  loc_1d77(m);
  assert.throws(() => assert.equal(r(m, 0x8004), 0x01));
});
