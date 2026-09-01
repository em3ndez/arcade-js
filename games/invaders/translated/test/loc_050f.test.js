// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_050f (ROM 0x050f-0x054f): object step handler. Pins the tail-delegate
// arm (jnz 0x055b taken) and the full ret arm (clamp taken, blit via loc_1a32, shld 0x2058, ret).
// m.call is record-only, so on the ret arm the final `ret` pops the last recorded push (0x0549) --
// a mock artifact, asserted as such.
//
// Run: node --test games/invaders/translated/test/loc_050f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_050f } from "../loc_050f.js";

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

test("loc_050f: 0x2078 != 0 -> tail-delegate to loc_055b; 170 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2046, 0x11);
  m.mem.write8(0x2036, 0x22);
  m.mem.write8(0x2076, 0x05);   // < 0x15 -> jc 0x0534 taken (clamp skipped)
  m.mem.write8(0x2078, 0x80);   // ana a -> NZ -> jnz 0x055b taken

  loc_050f(m);

  assert.equal(m.tstates, 170, "delegate arm total");
  assert.deepEqual(m.calls, [0x0550, 0x0563, 0x055b], "prime, step, tail-delegate");
  assert.equal(m.regs.a, 0x80, "A = (0x2078)");
  assert.equal(m.regs.hl, 0x2055, "lxi h,0x2055 before the delegate");
  assert.equal(m.regs.de, 0x2055, "lxi d,0x2055 (unchanged on this arm)");
  assert.equal(m.mem.read8(0x2070), 0x11, "0x2070 := (0x2046)");
  assert.equal(m.mem.read8(0x2071), 0x22, "0x2071 := (0x2036)");
  assert.equal(m.mem.read16(0x23fe), 0x0517, "call 0x0550 return addr");
  assert.equal(m.mem.read16(0x23fc), 0x0526, "call 0x0563 return addr");
  assert.equal(m.regs.sp, 0x23fc, "two pushes (-4)");
  assert.equal(m.pc, 0x055b, "delegates to loc_055b");
});

test("loc_050f: clamp arm blits via loc_1a32, shld 0x2058, ret; 282 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2046, 0x11);
  m.mem.write8(0x2036, 0x22);
  m.mem.write8(0x2076, 0x20);   // >= 0x15 -> jc not taken -> clamp
  m.mem.write8(0x1b58, 0x14);   // clamp value stored to 0x2076
  m.mem.write8(0x2077, 0x09);   // high byte for lhld 0x2076
  m.mem.write8(0x2078, 0x00);   // ana a -> Z -> jnz 0x055b not taken

  loc_050f(m);

  assert.equal(m.tstates, 282, "clamp+blit+ret arm total");
  assert.deepEqual(m.calls, [0x0550, 0x0563, 0x1a32], "prime, step, blit");
  assert.equal(m.regs.hl, 0x0914, "lhld 0x2076 after clamp low byte");
  assert.equal(m.regs.de, 0x1b50, "lxi d,0x1b50");
  assert.equal(m.regs.b, 0x10, "mvi b,0x10");
  assert.equal(m.regs.a, 0x00, "A = (0x2078)");
  assert.equal(m.mem.read8(0x2076), 0x14, "0x2076 clamped to (0x1b58)");
  assert.equal(m.mem.read16(0x2058), 0x0914, "shld 0x2058");
  assert.equal(m.mem.read16(0x23fe), 0x0517, "call 0x0550 return addr");
  assert.equal(m.mem.read16(0x23fc), 0x0526, "call 0x0563 return addr");
  assert.equal(m.mem.read16(0x23fa), 0x0549, "call 0x1a32 return addr");
  assert.equal(m.pc, 0x0549, "ret pops the last record-only push (mock artifact)");
  assert.equal(m.regs.sp, 0x23fc, "three pushes (-6) then ret (+2)");
});

test("loc_050f MUTATION: call 0x0563 mis-charged 11T (not 17) is caught by the golden total", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2076, 0x05);
  m.mem.write8(0x2078, 0x80);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0563 ? 11 : c); // call 0x0563 lands at 0x0563
  loc_050f(m);
  assert.equal(m.tstates, 164, "mutant loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 170, "golden T-state total catches the mutant");
});
