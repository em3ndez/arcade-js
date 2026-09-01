// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0476 (ROM 0x0476-0x04b5): dispatch object handler. Two arms are pinned --
// the 0x2038==0 arm that decrements and rets, and the primed arm that calls 0x0550/0x0563 and
// tail-delegates to loc_1a32. The mock records m.call targets rather than running them.
//
// Run: node --test games/invaders/translated/test/loc_0476.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0476 } from "../loc_0476.js";

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

test("loc_0476: 0x2038==0 -> dcx + shld 0x2038 + ret; 102 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x1b32, 0x5a);
  m.mem.write16(0x2400, 0xabcd); // pop h consumes this
  m.mem.write16(0x2402, 0x1234); // ret target
  // 0x2038 stays 0 -> the decrement-and-ret arm

  loc_0476(m);

  assert.equal(m.mem.read8(0x2032), 0x5a, "0x2032 := (0x1b32)");
  assert.equal(m.mem.read16(0x2038), 0xffff, "0 - 1 stored back to 0x2038");
  assert.equal(m.regs.hl, 0xffff, "HL := 0x2038 countdown, decremented");
  assert.equal(m.regs.a, 0x00, "A = L | H = 0");
  assert.equal(m.tstates, 102, "10+13+13+16+5+4+10+5+16+10");
  assert.equal(m.pc, 0x1234, "ret lands at seeded return addr");
  assert.equal(m.regs.sp, 0x2404, "pop h (+2) then ret (+2)");
  assert.deepEqual(m.calls, [], "no calls on the countdown arm");
  assert.deepEqual(m.pcSeq, [0x0477, 0x047a, 0x047d, 0x0480, 0x0481, 0x0482, 0x0485, 0x0486, 0x0489, 0x1234]);
});

test("loc_0476: primed arm calls 0x0550/0x0563, delegates to loc_1a32; 248 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x1b32, 0x5a);
  m.mem.write16(0x2038, 0x0001); // nonzero -> jnz 0x048a taken
  m.mem.write8(0x2046, 0x11);
  m.mem.write8(0x2056, 0x22);
  m.mem.write8(0x2078, 0x00);   // ana a -> Z -> jnz 0x055b not taken
  m.mem.write16(0x2400, 0x9999); // pop h consumes this

  loc_0476(m);

  assert.equal(m.tstates, 248, "full primed path through the loc_1a32 tail-jump");
  assert.deepEqual(m.calls, [0x0550, 0x0563, 0x1a32], "prime, step, blit-delegate");
  assert.equal(m.regs.hl, 0x2030, "lxi h,0x2030");
  assert.equal(m.regs.de, 0x1b30, "lxi d,0x1b30");
  assert.equal(m.regs.b, 0x10, "mvi b,0x10");
  assert.equal(m.regs.a, 0x00, "A = (0x2078) = 0");
  assert.equal(m.mem.read8(0x2070), 0x11, "0x2070 := (0x2046)");
  assert.equal(m.mem.read8(0x2071), 0x22, "0x2071 := (0x2056)");
  assert.equal(m.mem.read16(0x2400), 0x0492, "call 0x0550 return addr");
  assert.equal(m.mem.read16(0x23fe), 0x04a1, "call 0x0563 return addr");
  assert.equal(m.regs.sp, 0x23fe, "pop h (+2), two pushes (-4)");
  assert.equal(m.pc, 0x1a32, "delegates to loc_1a32");
});

test("loc_0476 MUTATION: lhld mis-charged 13T (not 16) is caught by the golden total", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x1b32, 0x5a);
  m.mem.write16(0x2402, 0x1234);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0480 ? 13 : c); // lhld lands at 0x0480
  loc_0476(m);
  assert.equal(m.tstates, 99, "mutant loses 3 T (16 -> 13)");
  assert.notEqual(m.tstates, 102, "golden T-state total catches the mutant");
});
