// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_088d (ROM 0x088d-0x08ce): render loc_08f3, cnc loc_08ff on bit0 of 0x2067,
// seat 0x20c0 = 0xb0, then drain 0x20c0 -- bit2 clear -> loc_09ca+loc_1931, bit2 set -> loc_14cb --
// until 0x20c0 reads 0 (rz). The mock's `call` pops the pushed return addr (models the callee ret)
// and, per test, mutates the 0x20c0 work-mask directly on ram (bypassing write8 so the `writes`
// log captures only loc_088d's own store of 0xb0).
//
// Run: node --test games/invaders/translated/test/loc_088d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_088d } from "../loc_088d.js";

const CALLER_RET = 0xabcd;

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
    regs, mem, ram, calls: [], writes: [], tstates: 0, pc: 0x088d, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
  // log only the routine's own stores (call models write ram directly)
  mem.write8 = (a, v) => { ram[a & 0xffff] = v & 0xff; if (a === 0x20c0) m.writes.push(v & 0xff); };
  return m;
}

test("loc_088d Path A: cnc taken, one loc_09ca/loc_1931 pass, then rz exit", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.ram[0x2067] = 0x00; // bit0 clear -> rrc carry clear -> cnc loc_08ff taken; 0xb0&4=0 -> 09ca path
  m.call = (addr) => { m.calls.push(addr); m.pop16(); if (addr === 0x09ca) m.ram[0x20c0] = 0x00; };

  loc_088d(m);

  assert.equal(m.tstates, 226, "Path A T-state total");
  assert.deepEqual(m.calls, [0x08f3, 0x08ff, 0x09ca, 0x1931], "render + shift-out + one drain pass");
  assert.deepEqual(m.writes, [0xb0], "loc_088d seats 0x20c0 = 0xb0");
  assert.deepEqual(m.pcSeq, [
    0x0890, 0x0893, 0x0895, 0x08f3, 0x089b, 0x089c, 0x089e, 0x08a1, 0x08ff, 0x08a6, 0x08a9,
    0x08ac, 0x08ad, 0x08ae, 0x08b0, 0x08b3, 0x09ca, 0x1931, 0x08a9,
    0x08ac, 0x08ad, CALLER_RET,
  ], "step boundaries (cnc taken, 09ca path, rz)");
  assert.equal(m.pc, CALLER_RET, "rz returns to caller once 0x20c0 == 0");
  assert.equal(m.regs.sp, 0x2400, "stack unwound to baseline");
});

test("loc_088d Path B: cnc not taken, drain reaches the bit2 (loc_14cb) branch", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.ram[0x2067] = 0x01; // bit0 set -> rrc carry set -> cnc not taken; also jc 0x08cb taken in 08bc
  m.call = (addr) => {
    m.calls.push(addr); m.pop16();
    if (addr === 0x09ca) m.ram[0x20c0] = 0x04; // next pass takes the bit2 branch
    if (addr === 0x14cb) m.ram[0x20c0] = 0x00; // then drained
  };

  loc_088d(m);

  assert.equal(m.tstates, 330, "Path B T-state total");
  assert.deepEqual(m.calls, [0x08f3, 0x09ca, 0x1931, 0x14cb], "no loc_08ff (cnc not taken); ends with blit");
  assert.deepEqual(m.writes, [0xb0], "loc_088d seats 0x20c0 = 0xb0");
  assert.deepEqual(m.pcSeq, [
    0x0890, 0x0893, 0x0895, 0x08f3, 0x089b, 0x089c, 0x089e, 0x08a1, 0x08a4, 0x08a6, 0x08a9,
    0x08ac, 0x08ad, 0x08ae, 0x08b0, 0x08b3, 0x09ca, 0x1931, 0x08a9,
    0x08ac, 0x08ad, 0x08ae, 0x08b0, 0x08bc, 0x08be, 0x08c1, 0x08c4, 0x08c5, 0x08cb, 0x14cb, 0x08a9,
    0x08ac, 0x08ad, CALLER_RET,
  ], "step boundaries (cnc not taken, bit2 branch, jc taken)");
  assert.equal(m.regs.hl, 0x271c, "08bc seats HL=0x271c; jc taken skips the 0x391c overwrite");
  assert.equal(m.regs.b, 0x20, "08bc seats B=0x20");
  assert.equal(m.regs.sp, 0x2400, "stack unwound to baseline");
});

test("loc_088d MUTATION: first `lxi h` mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.ram[0x2067] = 0x00;
  m.call = (addr) => { m.calls.push(addr); m.pop16(); if (addr === 0x09ca) m.ram[0x20c0] = 0x00; };
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0890 ? 4 : c); // step off the entry lxi h (unique in pcSeq)
  loc_088d(m);
  assert.equal(m.tstates, 220, "mutation loses 6 T (10 -> 4)");
  assert.notEqual(m.tstates, 226, "golden T-state total catches the mutant");
});
