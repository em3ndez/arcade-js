// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0804 (Frogger frog-object init, ROM 0x0804-0x0821): (0x8044)=1, (0x8045)=
// (0x8047)=0. In a 2-player game ((0x83FE)==2) also seed (0x83D2)=(0x83DA)=0x0040. 1-player stops
// after (0x8047) (81 T); 2-player runs the timers (137 T).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0804 } from "../loc_0804.js";

function mk(players) {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x3fe] = players;
  for (const a of [0x044, 0x045, 0x047]) m.mem.workRam[a] = 0xff;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const r16 = (m, a) => m.mem.workRam[a - 0x8000] | (m.mem.workRam[a - 0x8000 + 1] << 8);

function checkObj(m) {
  assert.equal(r(m, 0x8044), 0x01, "(0x8044) = 1");
  assert.equal(r(m, 0x8045), 0x00, "(0x8045) = 0");
  assert.equal(r(m, 0x8047), 0x00, "(0x8047) = 0");
}

test("loc_0804: 1-player inits the object and stops; 81 T", () => {
  const m = mk(0x01);
  loc_0804(m);
  checkObj(m);
  assert.equal(r16(m, 0x83d2), 0x0000, "no timer seeded in a 1-player game");
  assert.equal(m.cycles, 81, "through cp 0x02 + ret nz taken");
});

test("loc_0804: 2-player also seeds the two 0x0040 timers; 137 T", () => {
  const m = mk(0x02);
  loc_0804(m);
  checkObj(m);
  assert.equal(r16(m, 0x83d2), 0x0040, "(0x83d2) = 0x0040");
  assert.equal(r16(m, 0x83da), 0x0040, "(0x83da) = 0x0040");
  assert.equal(m.cycles, 137, "2-player path T total");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0804.js
//   find: mem.write8(regs.hl, 0x01);
//   repl: mem.write8(regs.hl, 0x02);
//   expect: FAIL  ((0x8044) = 2 instead of 1 — caught by checkObj)
//   verified-anchor: count == 1  (the sole immediate-1 store in loc_0804.js)
test("loc_0804: the contract catches a wrong object-active byte", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.hl = 0x8044; m.step(0x0807, 10);
    regs.xor(regs.a); m.step(0x0808, 4);
    mem.write8(regs.hl, 0x02); m.step(0x080a, 10); // MUTANT
    regs.l = regs.inc8(regs.l); m.step(0x080b, 4);
    mem.write8(regs.hl, regs.a); m.step(0x080c, 7);
    regs.l = regs.inc8(regs.l); m.step(0x080d, 4);
    regs.l = regs.inc8(regs.l); m.step(0x080e, 4);
    mem.write8(regs.hl, regs.a); m.step(0x080f, 7);
    regs.a = mem.read8(0x83fe); m.step(0x0812, 13);
    regs.cp(0x02); m.step(0x0814, 7);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x0815, 5);
    regs.hl = 0x0040; m.step(0x0818, 10);
    mem.write16(0x83d2, regs.hl); m.step(0x081b, 16);
    regs.hl = 0x0040; m.step(0x081e, 10);
    mem.write16(0x83da, regs.hl); m.step(0x0821, 16);
    m.ret();
  };
  const m = mk(0x01);
  mutant(m);
  assert.throws(() => checkObj(m));
});
