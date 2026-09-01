// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_156f (ROM 0x156f-0x1578): Y-scale. Pins the 0x200a load, the call to
// the scale helper 0x1554 (record-only), A := A-0x10 (SBI) into H, exact MAME i8080 T-states, the
// m.calls sequence, and that the pushed return round-trips through the final ret.
//
// Run: node --test games/invaders/translated/test/loc_156f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_156f } from "../loc_156f.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_156f: loads 0x200a, calls 0x1554, H := (A-0x10); 52 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; // the internal call's pushed 0x1575 doubles as the ret pop source
  m.mem.write8(0x200a, 0x55);
  m.regs.f = 0; // carry clear for SBI

  loc_156f(m);

  assert.equal(m.regs.a, 0x45, "A := 0x55 - 0x10 - 0 (SBI)");
  assert.equal(m.regs.h, 0x45, "H := A residual");
  assert.deepEqual(m.calls, [0x1554], "calls the scale helper 0x1554");
  assert.equal(m.pc, 0x1575, "ret pops the return addr pushed by `call 0x1554`");
  assert.equal(m.tstates, 52, "13+17+7+5+10 = 52 T");
});

test("loc_156f MUTATION: `lda 0x200a` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x200a, 0x55);
  m.regs.f = 0;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1572 ? 7 : c); // 0x1572 is the addr after lda
  loc_156f(m);
  assert.equal(m.tstates, 46, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 52, "golden T-state total catches the mutant");
});
