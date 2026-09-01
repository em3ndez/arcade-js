// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1671 (ROM 0x1671-0x16c8). Seats the compare pair so `cmp m` gives NZ+NC:
// the `jz 0x168b` falls through and `jnc 0x1698` is taken (skipping the copy at loc_168f). 0x20ce!=0
// keeps both `jz 0x16c9` untaken; 0x2067 bit0=1 keeps B=0x1b via `jc 0x16b7`; ends `jmp 0x02ed`.
//
// Run: node --test games/invaders/translated/test/loc_1671.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1671 } from "../loc_1671.js";

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
    regs, mem, ram, calls: [], pushes: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatArm(m) {
  m.regs.hl = 0x2100; // 0x1910 leaves HL here in the real routine; mvi m writes mem[0x2100]
  m.mem.write8(0x2100, 0x77); // prove mvi m,0x00 clears it
  m.mem.write8(0x2101, 0x30); // cmp m operand (HL after inx h)
  m.mem.write8(0x20f5, 0x50); // ldax d (first)  -> A=0x50, so cmp -> NZ, NC
  m.mem.write8(0x20f4, 0x00); // ldax d (second) -> A, does not affect flags
  m.mem.write8(0x20ce, 0x05); // ana a -> NZ, both jz 0x16c9 untaken
  m.mem.write8(0x2067, 0x01); // rrc -> carry set, jc 0x16b7 taken (B stays 0x1b)
  m.mem.write8(0x2603, 0x07); // mov a,m after dcr h twice (0x2803 -> 0x2603); ana a -> NZ
}

test("loc_1671: NZ+NC compare -> jnc-1698 arm, jmp 0x02ed; 312 T", () => {
  const m = makeMachine();
  seatArm(m);

  loc_1671(m);

  assert.equal(m.mem.read8(0x2100), 0x00, "mvi m,0x00 cleared mem[0x2100]");
  assert.equal(m.regs.a, 0x07, "A := mem[0x2603] at 0x16c1");
  assert.equal(m.regs.b, 0x1b, "B kept 0x1b (jc 0x16b7 taken, mvi b,0x1c skipped)");
  assert.equal(m.regs.c, 0x14, "C := 0x14");
  assert.equal(m.regs.hl, 0x2603, "HL := 0x2803 dcr h twice");
  assert.equal(m.regs.de, 0x1aa6, "DE := 0x1aa6");
  assert.deepEqual(
    m.calls,
    [0x1910, 0x09ca, 0x0a93, 0x08ff, 0x0ab1, 0x18e7, 0x02ed],
    "call chain then delegate to loc_02ed",
  );
  assert.deepEqual(
    m.pushes,
    [0x1674, 0x1679, 0x16aa, 0x16bb, 0x16be, 0x16c1],
    "CALL return addresses (jmp 0x02ed pushes nothing)",
  );
  assert.equal(m.pc, 0x02ed, "final step lands at the delegate target");
  assert.equal(m.tstates, 312, "T total for the jnc-1698 arm");
});

test("loc_1671 MUTATION: `call 0x18e7` mis-charged 11T (not 17T) is caught", () => {
  const m = makeMachine();
  seatArm(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x18e7 ? 11 : c); // call 0x18e7's step target (the callee)
  loc_1671(m);
  assert.equal(m.tstates, 306, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 312, "golden T-state total catches the mutant");
});
