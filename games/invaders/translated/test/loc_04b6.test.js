// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_04b6 (ROM 0x04b6-0x050d): dispatch object handler with two early rets.
// Pins the first `rnz` guard arm, and the full primed path (calls 0x0550/0x0563/0x1a32, clamp
// skipped, 0x0508 flag skipped) that tail-jumps to loc_067e. m.call is record-only.
//
// Run: node --test games/invaders/translated/test/loc_04b6.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_04b6 } from "../loc_04b6.js";

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

test("loc_04b6: 0x206e != 0 -> early rnz; 38 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x206e, 0x07);   // ana a -> NZ -> rnz returns
  m.mem.write16(0x2400, 0x9999); // pop h consumes this
  m.mem.write16(0x2402, 0x5678); // ret target

  loc_04b6(m);

  assert.equal(m.regs.a, 0x07, "A = (0x206e)");
  assert.equal(m.regs.hl, 0x9999, "HL from pop h");
  assert.equal(m.tstates, 38, "10+13+4+11");
  assert.equal(m.pc, 0x5678, "rnz lands at seeded return addr");
  assert.equal(m.regs.sp, 0x2404, "pop h (+2) then ret (+2)");
  assert.deepEqual(m.calls, [], "no calls before the guard");
  assert.deepEqual(m.pcSeq, [0x04b7, 0x04ba, 0x04bb, 0x5678]);
});

test("loc_04b6: primed path calls 0x0550/0x0563/0x1a32, tail-jumps loc_067e; 325 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x206e, 0x00);   // first rnz falls through
  m.mem.write8(0x2080, 0x01);   // cpi 0x01 -> Z -> second rnz falls through
  m.mem.write8(0x2036, 0x33);
  m.mem.write8(0x2056, 0x44);
  m.mem.write8(0x2076, 0x05);   // < 0x10 -> jc 0x04e7 taken (clamp skipped)
  m.mem.write8(0x2077, 0x07);   // high byte for lhld 0x2076
  m.mem.write8(0x2078, 0x00);   // ana a -> Z -> jnz 0x055b not taken
  m.mem.write8(0x2082, 0x03);   // dcr a -> 0x02 (NZ) -> jnz 0x0508 taken
  m.mem.write16(0x2400, 0x9999); // pop h consumes this

  loc_04b6(m);

  assert.equal(m.tstates, 325, "full primed path through the loc_067e tail-jump");
  assert.deepEqual(m.calls, [0x0550, 0x0563, 0x1a32, 0x067e]);
  assert.equal(m.regs.hl, 0x0705, "lhld 0x2076");
  assert.equal(m.regs.de, 0x1b40, "lxi d,0x1b40");
  assert.equal(m.regs.b, 0x10, "mvi b,0x10");
  assert.equal(m.regs.a, 0x02, "A = (0x2082) - 1");
  assert.equal(m.mem.read8(0x2070), 0x33, "0x2070 := (0x2036)");
  assert.equal(m.mem.read8(0x2071), 0x44, "0x2071 := (0x2056)");
  assert.equal(m.mem.read8(0x206e), 0x00, "0x0508 taken -> 0x206e flag NOT set");
  assert.equal(m.mem.read16(0x2400), 0x04ca, "call 0x0550 return addr");
  assert.equal(m.mem.read16(0x23fe), 0x04d9, "call 0x0563 return addr");
  assert.equal(m.mem.read16(0x23fc), 0x04fc, "call 0x1a32 return addr");
  assert.equal(m.regs.sp, 0x23fc, "pop h (+2), three pushes (-6)");
  assert.equal(m.pc, 0x067e, "tail-jumps to loc_067e");
});

test("loc_04b6 MUTATION: rnz mis-charged 5T (not 11) is caught by the golden total", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x206e, 0x07);
  m.mem.write16(0x2402, 0x5678);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x5678 ? 5 : c); // ret lands at 0x5678
  loc_04b6(m);
  assert.equal(m.tstates, 32, "mutant charges rnz 5 (not-taken) instead of 11 (taken)");
  assert.notEqual(m.tstates, 38, "golden T-state total catches the mutant");
});
