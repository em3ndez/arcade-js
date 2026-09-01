// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1740 (ROM 0x1740-0x176c): the shot/sound step. Full path -- the
// 0x209b timer decrements to zero (cz 0x176d), the 0x2068 gate is set (no bail), the 0x2096
// counter expires (rnz falls through), port 5 gets mem[0x2098], the 0x2082 gate is set, then
// HL walks 0x2098..0x2095 seeding a new step and reloading the 0x209b timer to 4. Plus a bail
// arm (0x2068 == 0 -> delegate to 0x176d) and a T-state mutation.
//
// Run: node --test games/invaders/translated/test/loc_1740.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1740 } from "../loc_1740.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    io: { outs: [], portOut(p, v) { this.outs.push([p, v & 0xff]); }, portIn() { return 0; } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

function seatFull(m) {
  m.regs.sp = 0x2400;
  m.ram[0x209b] = 0x01; // timer -> 0 -> cz 0x176d taken
  m.ram[0x2068] = 0x05; // gate set -> jz not taken
  m.ram[0x2096] = 0x01; // counter -> 0 -> rnz falls through
  m.ram[0x2098] = 0x27; // sound byte -> port 5
  m.ram[0x2082] = 0x09; // second gate set -> jz not taken
  m.ram[0x2097] = 0x33; // byte pulled back into 0x2096
}

test("loc_1740: full path -- cz fires, timer reloads to 4, port5<-0x27; 212 T", () => {
  const m = makeMachine();
  seatFull(m);

  loc_1740(m);

  assert.equal(m.mem.read8(0x209b), 0x04, "0x209b timer reloaded to 4");
  assert.equal(m.mem.read8(0x2096), 0x33, "0x2096 gets mem[0x2097] via mov m,a");
  assert.equal(m.mem.read8(0x2095), 0x01, "0x2095 seeded to 1 (mvi m,0x01)");
  assert.deepEqual(m.io.outs, [[0x05, 0x27]], "port 5 <- mem[0x2098]");
  assert.equal(m.regs.a, 0x04, "A ends 0x04 (mvi a,0x04)");
  assert.equal(m.regs.hl, 0x2095, "HL walked back to 0x2095");
  assert.equal(m.tstates, 212, "T total for the full run-to-ret path");
  assert.deepEqual(m.calls, [0x176d], "cz 0x176d fired once");
  assert.equal(m.mem.read16(0x23fe), 0x1747, "cz 0x176d pushes return 0x1747");
  assert.equal(m.pc, 0x1747, "record-only ret pops the pushed 0x1747");
});

test("loc_1740 BAIL arm: cz not taken, 0x2068==0 -> delegate to 0x176d; 58 T", () => {
  const m = makeMachine();
  seatFull(m);
  m.ram[0x209b] = 0x05; // dcr -> 4 (not zero) -> cz NOT taken
  m.ram[0x2068] = 0x00; // gate clear -> jz 0x176d taken

  loc_1740(m);

  assert.deepEqual(m.calls, [0x176d], "delegates straight to loc_176d");
  assert.equal(m.pc, 0x176d, "last step lands at the delegate");
  assert.equal(m.mem.read8(0x209b), 0x04, "0x209b decremented to 4, not reloaded");
  assert.equal(m.tstates, 10 + 10 + 11 + 13 + 4 + 10, "lxi+dcr+cz(nt)+lda+ana+jz(taken)");
  assert.deepEqual(m.io.outs, [], "no port write on the bail arm");
});

test("loc_1740 MUTATION: cz 0x176d taken mis-charged 11T not 17T is caught", () => {
  const m = makeMachine();
  seatFull(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x176d ? 11 : c);
  loc_1740(m);
  assert.notEqual(m.tstates, 212, "golden T-state total catches the mis-charged cz");
});
