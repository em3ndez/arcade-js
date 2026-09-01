// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0008 (ROM 0x0008-0x000e): the RST1 (mid-screen) vector -- saves
// PSW/BC/DE/HL then tail-delegates to loc_008c. Pins the four pushes (values + return-slot
// addresses), the SP after them, the exact T-states, and the delegate target.
//
// Run: node --test games/invaders/translated/test/loc_0008.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0008 } from "../loc_0008.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], ports: {},
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
  m.io = { portIn: (p) => m.ports[p] ?? 0, portOut: (p, v) => { m.ports[p] = v & 0xff; } };
  return m;
}

test("loc_0008: pushes PSW/BC/DE/HL, delegates to loc_008c; 54 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.a = 0x12; m.regs.f = 0x00; // af getter forces bit1 -> 0x1202
  m.regs.b = 0x34; m.regs.c = 0x56; // bc 0x3456
  m.regs.d = 0x78; m.regs.e = 0x9a; // de 0x789a
  m.regs.h = 0xbc; m.regs.l = 0xde; // hl 0xbcde

  loc_0008(m);

  assert.equal(m.regs.sp, 0x23f8, "SP: 0x2400 - four 2-byte pushes");
  assert.equal(m.tstates, 11 + 11 + 11 + 11 + 10, "T total: 4x push(11)+jmp(10)");
  assert.equal(m.pc, 0x008c, "last step lands at the delegate target");
  assert.deepEqual(m.calls, [0x008c], "tail-delegates to loc_008c");
  assert.equal(m.mem.read16(0x23fe), 0x1202, "push psw -> af with bit1 forced");
  assert.equal(m.mem.read16(0x23fc), 0x3456, "push b -> bc");
  assert.equal(m.mem.read16(0x23fa), 0x789a, "push d -> de");
  assert.equal(m.mem.read16(0x23f8), 0xbcde, "push h -> hl");
});

test("loc_0008 MUTATION: `jmp 0x008c` mis-charged 4T not 10T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x008c ? 4 : c);
  loc_0008(m);
  assert.notEqual(m.tstates, 54, "golden T-state total catches the mutant");
});
