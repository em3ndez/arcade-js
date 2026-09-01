// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_16e6 (ROM 0x16e6-0x170d): reseats SP, EI, clears 0x2015, then the wait loop.
// The record-only mock leaves `xra a`'s Z standing across `call 0x0a59`, so `jnz 0x16ee` is not taken
// and the loop runs exactly once; then the 0x19d7/0x19fa/0x1a8b tail and `jmp 0x196b`. 181 T.
//
// Run: node --test games/invaders/translated/test/loc_16e6.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_16e6 } from "../loc_16e6.js";

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
    io: { inte: false, setInte(on) { this.inte = !!on; } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_16e6: SP reseat + EI + clear 0x2015, one wait-loop pass, delegate to loc_196b; 181 T", () => {
  const m = makeMachine();
  m.mem.write8(0x2015, 0x33); // prove sta 0x2015 clears it

  loc_16e6(m);

  assert.equal(m.mem.read8(0x2015), 0x00, "xra a; sta 0x2015 cleared it");
  assert.equal(m.io.inte, true, "EI armed the interrupt-enable flip-flop");
  assert.equal(m.regs.sp, 0x23f4, "SP: 0x2400 - six 2-byte CALL pushes");
  assert.equal(m.regs.a, 0x00, "A := 0 via xra a at 0x1705");
  assert.equal(m.regs.b, 0xfb, "B := 0xfb at 0x1709");
  assert.equal(m.regs.hl, 0x2701, "HL := 0x2701");
  assert.deepEqual(
    m.calls,
    [0x14d8, 0x18fa, 0x0a59, 0x19d7, 0x19fa, 0x1a8b, 0x196b],
    "one loop pass then the tail chain and delegate to loc_196b",
  );
  assert.deepEqual(
    m.pushes,
    [0x16f1, 0x16f6, 0x16f9, 0x16ff, 0x1705, 0x1709],
    "CALL return addresses (jmp 0x196b pushes nothing)",
  );
  assert.equal(m.pc, 0x196b, "final step lands at the delegate target");
  assert.equal(m.tstates, 181, "T total for the single-pass arm");
});

test("loc_16e6 MUTATION: `ei` mis-charged 10T (not 4T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x16ea ? 10 : c); // ei's step target
  loc_16e6(m);
  assert.equal(m.tstates, 187, "mutation adds 6 T (4 -> 10)");
  assert.notEqual(m.tstates, 181, "golden T-state total catches the mutant");
});
