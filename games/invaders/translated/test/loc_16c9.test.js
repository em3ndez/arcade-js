// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_16c9 (ROM 0x16c9-0x16e5): straight-line -- seat HL/DE/C, run the 0x0a93 draw
// chain, clear 0x20ef + sound port 5 (OUT 05 <- 0), then delegate to loc_0b89. Deterministic, 132 T.
//
// Run: node --test games/invaders/translated/test/loc_16c9.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_16c9 } from "../loc_16c9.js";

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
    io: { outs: [], portOut(p, v) { this.outs.push([p, v & 0xff]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_16c9: draws 0x2d18, clears 0x20ef + OUT 05, delegates to loc_0b89; 132 T", () => {
  const m = makeMachine();
  m.mem.write8(0x20ef, 0x5a); // prove sta 0x20ef clears it

  loc_16c9(m);

  assert.equal(m.mem.read8(0x20ef), 0x00, "xra a; sta 0x20ef cleared it");
  assert.deepEqual(m.io.outs, [[0x05, 0x00]], "OUT 05 <- A (0)");
  assert.equal(m.regs.a, 0x00, "A := 0 via xra a");
  assert.equal(m.regs.hl, 0x2d18, "HL := 0x2d18");
  assert.equal(m.regs.de, 0x1aa6, "DE := 0x1aa6");
  assert.equal(m.regs.c, 0x0a, "C := 0x0a");
  assert.deepEqual(m.calls, [0x0a93, 0x0ab6, 0x09d6, 0x19d1, 0x0b89], "call chain then delegate");
  assert.deepEqual(m.pushes, [0x16d4, 0x16d7, 0x16da, 0x16e3], "CALL return addresses");
  assert.equal(m.pc, 0x0b89, "final step lands at the delegate target");
  assert.equal(m.tstates, 132, "T total");
});

test("loc_16c9 MUTATION: `out 0x05` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x16e0 ? 7 : c); // out 0x05's step target
  loc_16c9(m);
  assert.equal(m.tstates, 129, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 132, "golden T-state total catches the mutant");
});
