// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1562 (ROM 0x1562-0x156e): X-scale. Pins the 0x2009 load, H:=L mirror,
// the call to the scale helper 0x1554 (record-only), the B:=C / dcr B / SBI 0x10 arithmetic into
// L, exact MAME i8080 T-states, the m.calls sequence, and that the pushed return round-trips.
//
// Run: node --test games/invaders/translated/test/loc_1562.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1562 } from "../loc_1562.js";

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

test("loc_1562: loads 0x2009, mirrors L, calls 0x1554, L := (A-0x10); 67 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; // the internal call's pushed 0x1569 doubles as the ret pop source
  m.mem.write8(0x2009, 0x42);
  m.regs.l = 0x07; m.regs.c = 0x05; m.regs.f = 0; // carry clear for SBI

  loc_1562(m);

  assert.equal(m.regs.a, 0x32, "A := 0x42 - 0x10 - 0 (SBI)");
  assert.equal(m.regs.h, 0x07, "H := L (mov h,l before the call)");
  assert.equal(m.regs.b, 0x04, "B := C then dcr B (0x05 -> 0x04)");
  assert.equal(m.regs.l, 0x32, "L := A residual");
  assert.deepEqual(m.calls, [0x1554], "calls the scale helper 0x1554");
  assert.equal(m.pc, 0x1569, "ret pops the return addr pushed by `call 0x1554`");
  assert.equal(m.tstates, 67, "13+5+17+5+5+7+5+10 = 67 T");
});

test("loc_1562 MUTATION: SBI mis-lifted as SUI (ignoring borrow) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2009, 0x42);
  m.regs.l = 0x07; m.regs.c = 0x05; m.regs.f = 0x01; // carry SET -> SBI must subtract the extra 1

  loc_1562(m);

  assert.equal(m.regs.a, 0x31, "SBI with carry set: 0x42 - 0x10 - 1 = 0x31 (SUI would give 0x32)");
  assert.notEqual(m.regs.a, 0x32, "a SUI mis-lift would leave 0x32");
});
