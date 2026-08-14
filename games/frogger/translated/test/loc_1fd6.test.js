// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1fd6 (Frogger progress scoring, ROM 0x1FD6-0x2004): gate the frog column
// (0x8047) to [0x30,0xd0], and on a new furthest column (below 0x8269) store it and award via
// loc_08e0 (stubbed here as an SP-balancer). 0xd0 seeds 0x8269=0xe0 first; 0x80 awards nothing.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1fd6 } from "../loc_1fd6.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // stub loc_08e0: pop its return

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x08e0, bal]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.hl = 0xcafe;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function checkAward(m) {
  assert.equal(r(m, 0x8269), 0x40, "furthest column updated to C");
  assert.equal(m.regs.de, 0x0001, "DE = the point delta");
  assert.equal(m.regs.hl, 0xcafe, "HL restored across the award call");
  assert.deepEqual(m.calls, [0x08e0], "awarded via loc_08e0 exactly once");
}

test("loc_1fd6: new record awards — stores C, DE=1, calls 0x08e0; 162 T", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0x40; m.mem.workRam[0x269] = 0x90;
  loc_1fd6(m);
  checkAward(m);
  assert.equal(m.cycles, 162, "full award path");
});

test("loc_1fd6: column below 0x30 rets immediately; 31 T", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0x20; m.mem.workRam[0x269] = 0x90;
  loc_1fd6(m);
  assert.equal(r(m, 0x8269), 0x90, "furthest untouched");
  assert.deepEqual(m.calls, [], "no award");
  assert.equal(m.cycles, 31, "ld a 13 + cp 7 + ret c 11");
});

test("loc_1fd6: column above 0xd0 rets (ret nc); 54 T", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0xe0; m.mem.workRam[0x269] = 0x90;
  loc_1fd6(m);
  assert.equal(r(m, 0x8269), 0x90, "furthest untouched");
  assert.deepEqual(m.calls, [], "no award");
  assert.equal(m.cycles, 54, "13+7+5+7+4+7 + ret nc 11");
});

test("loc_1fd6: not a new record (furthest below C) rets via ret c; no award", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0x90; m.mem.workRam[0x269] = 0x40;
  loc_1fd6(m);
  assert.equal(r(m, 0x8269), 0x40, "furthest untouched");
  assert.deepEqual(m.calls, [], "no award");
});

test("loc_1fd6: midpoint 0x80 updates furthest but awards nothing (ret z); 120 T", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0x80; m.mem.workRam[0x269] = 0x90;
  loc_1fd6(m);
  assert.equal(r(m, 0x8269), 0x80, "furthest set to 0x80");
  assert.equal(m.regs.de, 0x0001, "DE loaded before the 0x80 test");
  assert.deepEqual(m.calls, [], "no award at the midpoint");
  assert.equal(m.cycles, 120, "through ret z at 0x1ff1");
});

test("loc_1fd6: column 0xd0 with furthest 0 seeds 0xe0 then scores 0xd0", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0xd0; m.mem.workRam[0x269] = 0x00;
  loc_1fd6(m);
  assert.equal(r(m, 0x8269), 0xd0, "furthest ends at 0xd0 after the 0xe0 seed");
  assert.deepEqual(m.calls, [0x08e0], "the 0xd0 crossing awards");
});

test("loc_1fd6: column 0xd0 with furthest already 0xd0 rets, no award", () => {
  const m = mk();
  m.mem.workRam[0x047] = 0xd0; m.mem.workRam[0x269] = 0xd0;
  loc_1fd6(m);
  assert.equal(r(m, 0x8269), 0xd0, "furthest unchanged");
  assert.deepEqual(m.calls, [], "no award");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1fd6.js
//   find: regs.a = regs.c;
//   repl: regs.a = regs.b;
//   expect: FAIL  (stores B, not the frog column C, into 0x8269 — caught by checkAward)
//   verified-anchor: count == 1  (the sole `regs.a = regs.c;` — the ld a,c at 0x1fe8)
test("loc_1fd6: the contract catches storing the wrong register as the new column", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x8047); m.step(0x1fd9, 13);
    regs.cp(0x30); m.step(0x1fdb, 7);
    if (regs.fC) { m.ret(11); return; }
    m.step(0x1fdc, 5);
    regs.cp(0xd0); m.step(0x1fde, 7);
    regs.c = regs.a; m.step(0x1fdf, 4);
    if (regs.fZ) { throw new Error("mutant drove the 0x1ff8 arm"); }
    m.step(0x1fe1, 7);
    if (regs.fNC) { m.ret(11); return; }
    m.step(0x1fe2, 5);
    regs.a = mem.read8(0x8269); m.step(0x1fe5, 13);
    regs.cp(regs.c); m.step(0x1fe6, 4);
    if (regs.fC) { m.ret(11); return; }
    m.step(0x1fe7, 5);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x1fe8, 5);
    regs.a = regs.b; m.step(0x1fe9, 4); // MUTANT: B instead of C
    mem.write8(0x8269, regs.a); m.step(0x1fec, 13);
    regs.de = 0x0001; m.step(0x1fef, 10);
    regs.cp(0x80); m.step(0x1ff1, 7);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x1ff2, 5);
    m.push16(regs.hl); m.step(0x1ff3, 11);
    m.push16(0x1ff6); m.step(0x08e0, 17);
    m.call(0x08e0);
    regs.hl = m.pop16(); m.step(0x1ff7, 10);
    m.ret();
  };
  const m = mk();
  m.mem.workRam[0x047] = 0x40; m.mem.workRam[0x269] = 0x90;
  mutant(m);
  assert.throws(() => checkAward(m));
});
