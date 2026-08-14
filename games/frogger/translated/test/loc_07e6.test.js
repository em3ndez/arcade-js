// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_07e6 (Frogger clear player work RAM, ROM 0x07E6-0x0803). 1-player
// ((0x83FE)==1) rets immediately; 2-player zeroes 0x8044-0x8063 and 0x8420-0x842B via two LDIRs.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_07e6, loc_07eb } from "../loc_07e6.js";

function mk(players) {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x07eb, loc_07eb]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x3fe] = players;
  for (let a = 0x044; a <= 0x063; a++) m.mem.workRam[a] = 0xff;
  for (let a = 0x420; a <= 0x42b; a++) m.mem.workRam[a] = 0xff;
  return m;
}

function check2p(m) {
  for (let a = 0x044; a <= 0x063; a++) assert.equal(m.mem.workRam[a], 0x00, `0x8${a.toString(16)} cleared`);
  for (let a = 0x420; a <= 0x42b; a++) assert.equal(m.mem.workRam[a], 0x00, `0x8${a.toString(16)} cleared`);
  assert.equal(m.mem.workRam[0x42c], 0xff, "0x842c (beyond block 2) untouched");
}

test("loc_07e6: 2-player clears both work-RAM blocks", () => {
  const m = mk(0x02);
  m.mem.workRam[0x42c] = 0xff;
  loc_07e6(m);
  check2p(m);
});

test("loc_07e6: 1-player rets immediately, no clear; 28 T", () => {
  const m = mk(0x01);
  loc_07e6(m);
  assert.equal(m.mem.workRam[0x044], 0xff, "block untouched in a 1-player game");
  assert.equal(m.cycles, 28, "ld a,(nn)13 + dec a 4 + ret z taken 11");
  assert.equal(m.pc, 0xbeef, "ret to caller");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_07e6.js
//   find: regs.c = 0x0b;
//   repl: regs.c = 0x0a;
//   expect: FAIL  (second LDIR clears one byte fewer; 0x842b stays 0xff — caught by check2p)
//   verified-anchor: count == 1  (the sole ld c,0x0b in loc_07e6.js)
test("loc_07e6: the contract catches a short second-block count", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x83fe); m.step(0x07e9, 13);
    regs.a = regs.dec8(regs.a); m.step(0x07ea, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x07eb, 5);
    regs.xor(regs.a); m.step(0x07ec, 4);
    regs.hl = 0x8044; m.step(0x07ef, 10);
    regs.de = 0x8045; m.step(0x07f2, 10);
    regs.bc = 0x001f; m.step(0x07f5, 10);
    mem.write8(regs.hl, regs.b); m.step(0x07f6, 7);
    m.ldirAt(0x07f6, 0x07f8);
    regs.hl = 0x8420; m.step(0x07fb, 10);
    regs.de = 0x8421; m.step(0x07fe, 10);
    regs.c = 0x0a; m.step(0x0800, 7); // MUTANT: one byte short
    mem.write8(regs.hl, regs.a); m.step(0x0801, 7);
    m.ldirAt(0x0801, 0x0803);
    m.ret();
  };
  const m = mk(0x02);
  mutant(m);
  assert.throws(() => check2p(m));
});
