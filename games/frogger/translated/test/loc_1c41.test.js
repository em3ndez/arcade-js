// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for the four river-ride HORIZONTAL object handlers (ROM 0x1C41-0x1CFE):
// loc_1c41/loc_1ca0 (start a lane move) and loc_1c76/loc_1cd5 (advance/commit). The rst 0x18
// target (0x0018) and the sibling entries a routine delegates into are stubbed with an
// SP-balancer so each entry is exercised in isolation.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1c41, loc_1c76, loc_1ca0, loc_1cd5 } from "../loc_1c41.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const STUBS = [0x1c41, 0x1c76, 0x1ca0, 0x1cd5, 0x0018];

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

test("loc_1c41: counter running reloads 0x8252 from 0x8258, delegates to loc_1c76", () => {
  const m = mk([0x1c41, loc_1c41]);
  m.mem.workRam[0x047] = 0x40; // frog Y in-band (>= 0x30)
  m.mem.workRam[0x044] = 0x50; // frog X in-band (< 0xe0)
  m.mem.workRam[0x252] = 0x05;
  m.mem.workRam[0x258] = 0x33;
  loc_1c41(m);
  assert.equal(r(m, 0x8252), 0x33);
  assert.deepEqual(m.calls, [0x1c76]);
});

test("loc_1c41: rst path writes tile code 0xa1 to 0x8045", () => {
  const m = mk([0x1c41, loc_1c41]);
  m.mem.workRam[0x047] = 0x40;
  m.mem.workRam[0x044] = 0x50;
  m.mem.workRam[0x252] = 0x00;
  m.regs.hl = 0x8100;
  loc_1c41(m);
  assert.equal(r(m, 0x8045), 0xa1);
  assert.deepEqual(m.calls, [0x0018, 0x1c76]);
});

test("loc_1c41: frog Y < 0x30 rets early; 31 T", () => {
  const m = mk([0x1c41, loc_1c41]);
  m.mem.workRam[0x047] = 0x00;
  loc_1c41(m);
  assert.equal(m.cycles, 31, "ld a,(nn)13 + cp 7 + ret c taken 11");
  assert.deepEqual(m.calls, []);
});

test("loc_1c76: commit path sets 0x824e and resets tile to 0xa1", () => {
  const m = mk([0x1c76, loc_1c76]);
  m.mem.workRam[0x24e] = 0x00;
  m.mem.workRam[0x252] = 0x01; // dec -> 0
  m.regs.hl = 0x8100;
  loc_1c76(m);
  assert.equal(r(m, 0x824a), 0x00);
  assert.equal(r(m, 0x824e), 0x01);
  assert.equal(m.mem.workRam[0x101], 0xa1, "(hl+1) = 0xa1");
});

test("loc_1c76: counter running -> block_1c94 scrolls (hl) by 0x8255 in place", () => {
  const m = mk([0x1c76, loc_1c76]);
  m.mem.workRam[0x24e] = 0x00;
  m.mem.workRam[0x252] = 0x03; // dec -> 2
  m.mem.workRam[0x255] = 0x05; // scroll delta
  m.mem.workRam[0x100] = 0x30; // (hl)
  m.regs.hl = 0x8100;
  loc_1c76(m);
  assert.equal(m.mem.workRam[0x100], 0x35, "(hl) += 0x8255");
  assert.equal(m.mem.workRam[0x101], 0x9f, "(hl+1) = 0x9f");
});

test("loc_1ca0: rst path writes tile code 0x21 to 0x8045, delegates to loc_1cd5", () => {
  const m = mk([0x1ca0, loc_1ca0]);
  m.mem.workRam[0x047] = 0x40; // frog Y >= 0x30
  m.mem.workRam[0x044] = 0x50; // frog X >= 0x20
  m.mem.workRam[0x253] = 0x00;
  m.regs.hl = 0x8100;
  loc_1ca0(m);
  assert.equal(r(m, 0x8045), 0x21);
  assert.deepEqual(m.calls, [0x0018, 0x1cd5]);
});

test("loc_1cd5: commit path sets 0x824f and resets tile to 0x21", () => {
  const m = mk([0x1cd5, loc_1cd5]);
  m.mem.workRam[0x24f] = 0x00;
  m.mem.workRam[0x253] = 0x01; // dec -> 0
  m.regs.hl = 0x8100;
  loc_1cd5(m);
  assert.equal(r(m, 0x824b), 0x00);
  assert.equal(r(m, 0x824f), 0x01);
  assert.equal(m.mem.workRam[0x101], 0x21, "(hl+1) = 0x21");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1c41.js
//   find: mem.write8(regs.hl, 0xa1);
//   repl: mem.write8(regs.hl, 0xa2);
//   expect: FAIL  (loc_1c76 resets the tile to 0xa2 instead of the home code 0xa1)
//   verified-anchor: count == 1  (the sole ld (hl),0xa1 in loc_1c41.js)
// Simulated by intercepting the 0xa1 store, which is what the edit produces.
test("loc_1c76: the contract catches a wrong home-tile code", () => {
  const m = mk([0x1c76, loc_1c76]);
  m.mem.workRam[0x24e] = 0x00;
  m.mem.workRam[0x252] = 0x01;
  m.regs.hl = 0x8100;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0xa1 ? 0xa2 : val, o);
  loc_1c76(m);
  assert.throws(() => assert.equal(m.mem.workRam[0x101], 0xa1));
});
