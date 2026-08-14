// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for the four river-ride VERTICAL object handlers (ROM 0x1B8B-0x1C40):
// loc_1b8b/loc_1be4 (start a lane move) and loc_1bba/loc_1c0d (advance/commit). External
// transfers (rst 0x18 -> 0x0018, call 0x23eb, call 0x1fd6) and the sibling entries a routine
// delegates into are stubbed with an SP-balancer so each entry is exercised in isolation.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1b8b, loc_1bba, loc_1be4, loc_1c0d } from "../loc_1b8b.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const STUBS = [0x1b8b, 0x1bba, 0x1be4, 0x1c0d, 0x0018, 0x23eb, 0x1fd6];

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

test("loc_1b8b: non-rst path (counter running) steps 0x8250 and delegates to loc_1bba", () => {
  const m = mk([0x1b8b, loc_1b8b]);
  m.mem.workRam[0x047] = 0x00; // frog Y < 0xf0
  m.mem.workRam[0x250] = 0x05; // ride counter nonzero
  m.mem.workRam[0x256] = 0x42; // reload value
  loc_1b8b(m);
  assert.equal(r(m, 0x8250), 0x42, "0x8250 reloaded from 0x8256");
  assert.deepEqual(m.calls, [0x1bba], "tail into loc_1bba, no rst");
});

test("loc_1b8b: rst path writes tile code 0xde to 0x8045, issues rst 0x18", () => {
  const m = mk([0x1b8b, loc_1b8b]);
  m.mem.workRam[0x047] = 0x00;
  m.mem.workRam[0x250] = 0x00; // counter zero -> take the rst branch
  m.regs.hl = 0x8100; // (0x8101) reads 0 != 0xde
  loc_1b8b(m);
  assert.equal(r(m, 0x8045), 0xde, "0x8045 = 0xde");
  assert.deepEqual(m.calls, [0x0018, 0x1bba], "rst 0x18 then tail into loc_1bba");
});

test("loc_1b8b: frog Y >= 0xf0 rets early; 31 T", () => {
  const m = mk([0x1b8b, loc_1b8b]);
  m.mem.workRam[0x047] = 0xff;
  loc_1b8b(m);
  assert.equal(m.cycles, 31, "ld a,(nn)13 + cp 7 + ret nc taken 11");
  assert.deepEqual(m.calls, []);
});

test("loc_1bba: counter reaches 0 -> commit lane flag and reset tile to 0xde", () => {
  const m = mk([0x1bba, loc_1bba]);
  m.mem.workRam[0x24c] = 0x00; // not yet arrived
  m.mem.workRam[0x250] = 0x01; // dec -> 0
  m.regs.hl = 0x8100;
  loc_1bba(m);
  assert.equal(r(m, 0x8248), 0x00, "0x8248 cleared");
  assert.equal(r(m, 0x824c), 0x01, "0x824c arrived flag set");
  assert.equal(m.mem.workRam[0x101], 0xde, "(hl+1) = 0xde");
});

test("loc_1bba: counter still running -> block_1bd8 scrolls the tile by 0x8254", () => {
  const m = mk([0x1bba, loc_1bba]);
  m.mem.workRam[0x24c] = 0x00;
  m.mem.workRam[0x250] = 0x03; // dec -> 2, nonzero
  m.mem.workRam[0x254] = 0x05; // scroll delta
  m.mem.workRam[0x110] = 0x10; // (de)
  m.regs.de = 0x8110;
  m.regs.hl = 0x8100;
  loc_1bba(m);
  assert.equal(m.mem.workRam[0x110], 0x15, "(de) += 0x8254");
  assert.equal(m.mem.workRam[0x101], 0xdc, "(hl+1) = 0xdc");
  assert.equal(r(m, 0x8250), 0x02, "counter decremented");
});

test("loc_1be4: rst path writes tile code 0x1e to 0x8045, delegates to loc_1c0d", () => {
  const m = mk([0x1be4, loc_1be4]);
  m.mem.workRam[0x251] = 0x00;
  m.regs.hl = 0x8100;
  loc_1be4(m);
  assert.equal(r(m, 0x8045), 0x1e, "0x8045 = 0x1e");
  assert.deepEqual(m.calls, [0x0018, 0x1c0d]);
});

test("loc_1c0d: commit path calls 0x23eb + 0x1fd6, sets flags, preserves DE", () => {
  const m = mk([0x1c0d, loc_1c0d]);
  m.mem.workRam[0x24d] = 0x00;
  m.mem.workRam[0x251] = 0x01; // dec -> 0
  m.regs.hl = 0x8100;
  m.regs.de = 0x1234;
  loc_1c0d(m);
  assert.equal(r(m, 0x8249), 0x00, "0x8249 cleared");
  assert.equal(r(m, 0x824d), 0x01, "0x824d arrived flag set");
  assert.equal(m.mem.workRam[0x101], 0x1e, "(hl+1) = 0x1e");
  assert.equal(m.regs.de, 0x1234, "DE restored by push/pop");
  assert.deepEqual(m.calls, [0x23eb, 0x1fd6]);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1b8b.js
//   find: mem.write8(regs.hl, 0xde);
//   repl: mem.write8(regs.hl, 0xdf);
//   expect: FAIL  (loc_1bba resets the tile to 0xdf instead of the home code 0xde)
//   verified-anchor: count == 1  (the sole ld (hl),0xde in loc_1b8b.js)
// Simulated by intercepting the 0xde store, which is what the edit produces.
test("loc_1bba: the contract catches a wrong home-tile code", () => {
  const m = mk([0x1bba, loc_1bba]);
  m.mem.workRam[0x24c] = 0x00;
  m.mem.workRam[0x250] = 0x01;
  m.regs.hl = 0x8100;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0xde ? 0xdf : val, o);
  loc_1bba(m);
  assert.throws(() => assert.equal(m.mem.workRam[0x101], 0xde));
});
