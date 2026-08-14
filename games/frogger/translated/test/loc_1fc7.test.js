// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1fc7 (Frogger NMI gate, ROM 0x1FC7-0x1FD5): if (0x826C)==0 ret; else count
// (0x826A) down, and when it reaches 0 clear (0x826C).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1fc7 } from "../loc_1fc7.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_1fc7: (0x826C)==0 rets immediately; 28 T", () => {
  const m = mk();
  loc_1fc7(m);
  assert.equal(m.cycles, 28, "ld a,(nn)13 + and a 4 + ret z 11");
});

test("loc_1fc7: (0x826A)>1 just decrements it, keeps (0x826C)", () => {
  const m = mk();
  m.mem.workRam[0x26c] = 0x01; m.mem.workRam[0x26a] = 0x03;
  loc_1fc7(m);
  assert.equal(r(m, 0x826a), 0x02, "(0x826a) 3 -> 2");
  assert.equal(r(m, 0x826c), 0x01, "still armed");
});

function checkExpire(m) {
  assert.equal(r(m, 0x826a), 0x00, "(0x826a) 1 -> 0");
  assert.equal(r(m, 0x826c), 0x00, "(0x826c) cleared on expiry");
  assert.equal(m.cycles, 75, "13+4+5+10+11+5+4+13+10 through the clear + ret");
}

test("loc_1fc7: (0x826A)==1 hits zero and clears (0x826C); 75 T", () => {
  const m = mk();
  m.mem.workRam[0x26c] = 0x01; m.mem.workRam[0x26a] = 0x01;
  loc_1fc7(m);
  checkExpire(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1fc7.js
//   find: mem.write8(0x826c, regs.a);
//   repl: mem.write8(0x826b, regs.a);
//   expect: FAIL  (clears the wrong cell; (0x826c) stays 1 — caught by checkExpire)
//   verified-anchor: count == 1  (the sole (0x826c) store in loc_1fc7.js)
test("loc_1fc7: the contract catches a wrong clear address", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x826c); m.step(0x1fca, 13);
    regs.and(regs.a); m.step(0x1fcb, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x1fcc, 5);
    regs.hl = 0x826a; m.step(0x1fcf, 10);
    regs.decMem8(mem, regs.hl); m.step(0x1fd0, 11);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x1fd1, 5);
    regs.xor(regs.a); m.step(0x1fd2, 4);
    mem.write8(0x826b, regs.a); m.step(0x1fd5, 13); // MUTANT: wrong cell
    m.ret();
  };
  const m = mk();
  m.mem.workRam[0x26c] = 0x01; m.mem.workRam[0x26a] = 0x01;
  mutant(m);
  assert.throws(() => checkExpire(m));
});
