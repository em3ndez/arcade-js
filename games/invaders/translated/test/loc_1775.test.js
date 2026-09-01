// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1775 (ROM 0x1775-0x17b3): the sound-pitch step. Trigger-set path --
// 0x2095 is set so the block runs: scan the 0x1a11 threshold table (parallel 0x1a21) for the
// first entry <= mem[0x2082], store the picked value to 0x2097, compose a new port-5 sound byte
// into mem[0x2098] (0x30 bits | possibly-doubled 0x0f pitch), clear 0x2095; then tick the 0x2099
// timer -- here it hits zero so it seeds B=0xef and tail-jumps to 0x19dc. Plus a trigger-clear
// skip arm (rnz returns) and a T-state mutation.
//
// Run: node --test games/invaders/translated/test/loc_1775.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1775 } from "../loc_1775.js";

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

function seatBlock(m) {
  m.regs.sp = 0x2400;
  m.ram[0x2095] = 0x01; // trigger set -> block runs
  m.ram[0x2082] = 0x50; // the compare key
  m.ram[0x1a11] = 0x80; m.ram[0x1a12] = 0x60; m.ram[0x1a13] = 0x40; // thresholds
  m.ram[0x1a23] = 0x22; // parallel value picked at the 3rd entry
  m.ram[0x2098] = 0x28; // 0x30 bits=0x20; pitch nibble 0x08 rlc-> 0x10 -> forced 0x01
  m.ram[0x2099] = 0x01; // timer -> 0 -> rnz falls through -> tail jmp
}

test("loc_1775: block runs, composes port byte, timer expires -> delegate 0x19dc; 312 T", () => {
  const m = makeMachine();
  seatBlock(m);

  loc_1775(m);

  assert.equal(m.mem.read8(0x2097), 0x22, "picked value stored to 0x2097");
  assert.equal(m.mem.read8(0x2098), 0x21, "new sound byte = 0x20 (high bits) | 0x01 (forced pitch)");
  assert.equal(m.mem.read8(0x2095), 0x00, "trigger cleared (xra a; sta)");
  assert.equal(m.mem.read8(0x2099), 0x00, "0x2099 timer decremented to 0");
  assert.equal(m.regs.b, 0xef, "B seeded 0xef before the tail jump");
  assert.equal(m.regs.a, 0x00, "A ends 0 (xra a)");
  assert.equal(m.regs.de, 0x1a23, "DE advanced twice into the parallel table");
  assert.equal(m.regs.hl, 0x2099, "HL last loaded the 0x2099 timer");
  assert.equal(m.tstates, 312, "T total for the full block+expire path");
  assert.deepEqual(m.calls, [0x19dc], "tail-delegates to loc_19dc");
  assert.equal(m.pc, 0x19dc, "last step lands at the delegate");
});

test("loc_1775 SKIP arm: 0x2095==0 -> skip block, rnz returns; 58 T", () => {
  const m = makeMachine();
  seatBlock(m);
  m.ram[0x2095] = 0x00; // trigger clear -> jz 0x17aa taken, block skipped
  m.ram[0x2099] = 0x03; // dcr -> 2 (not zero) -> rnz returns
  m.ram[0x2400] = 0x00; m.ram[0x2401] = 0x06; // sentinel return 0x0600

  loc_1775(m);

  assert.deepEqual(m.calls, [], "no delegation on the rnz-return arm");
  assert.equal(m.mem.read8(0x2099), 0x02, "timer decremented to 2");
  assert.equal(m.mem.read8(0x2097), 0x00, "block skipped -> 0x2097 untouched");
  assert.equal(m.tstates, 13 + 4 + 10 + 10 + 10 + 11, "lda+ana+jz(taken)+lxi+dcr+rnz(taken)");
  assert.equal(m.pc, 0x0600, "rnz pops the sentinel return");
});

test("loc_1775 MUTATION: jnc 0x178e taken mis-charged 6T not 10T is caught", () => {
  const m = makeMachine();
  seatBlock(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x178e ? 6 : c);
  loc_1775(m);
  assert.notEqual(m.tstates, 312, "golden T-state total catches the mis-charged jnc");
});
