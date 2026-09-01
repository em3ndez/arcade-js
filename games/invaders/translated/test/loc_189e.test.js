// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_189e (ROM 0x189e-0x18d3): init via loc_1a32, seed 0x2080/0x207e/0x20c1,
// busy-wait bit0 of 0x2055 (spin until set, then until clear), then loc_08ff and tail-jmp loc_0ab6.
// read8 for 0x2055 returns 0x01 first (loop1 exits) then 0x00 (loop2 exits), so both spins run once.
// Record-only `call` leaves the internal call returns on the stack, so they are asserted directly.
//
// Run: node --test games/invaders/translated/test/loc_189e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_189e } from "../loc_189e.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  let reads2055 = 0;
  const mem = {
    read8: (a) => {
      if ((a & 0xffff) === 0x2055) return reads2055++ === 0 ? 0x01 : 0x00;
      return ram[a & 0xffff];
    },
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x189e, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_189e: seeds flags, both spins run once, calls loc_08ff, tail-jmp loc_0ab6; 212 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_189e(m);

  assert.equal(m.mem.read8(0x2080), 0x02, "0x2080 := 2");
  assert.equal(m.mem.read8(0x207e), 0xff, "0x207e := 0xff");
  assert.equal(m.mem.read8(0x20c1), 0x04, "0x20c1 := 4");
  assert.equal(m.regs.hl, 0x3311, "HL := 0x3311 (text ptr)");
  assert.equal(m.regs.a, 0x26, "A := 0x26 before loc_08ff");
  assert.equal(m.regs.b, 0x10, "B := 0x10 (from loc_1a32 setup)");
  assert.deepEqual(m.calls, [0x1a32, 0x08ff, 0x0ab6], "loc_1a32, loc_08ff, tail-jmp loc_0ab6");
  assert.equal(m.mem.read16(0x23fe), 0x18a9, "call 0x1a32 pushes return 0x18a9");
  assert.equal(m.mem.read16(0x23fc), 0x18d1, "call 0x08ff pushes return 0x18d1");
  assert.equal(m.tstates, 212, "T total: two single-pass spins");
  assert.equal(m.pc, 0x0ab6, "tail-jmp lands at loc_0ab6");
  assert.deepEqual(m.pcSeq, [
    0x18a1, 0x18a4, 0x18a6, 0x1a32, 0x18ab, 0x18ae, 0x18b0, 0x18b3, 0x18b5, 0x18b8,
    0x18bb, 0x18bd, 0x18c0, // loop1: exits (bit set)
    0x18c3, 0x18c5, 0x18c8, // loop2: exits (bit clear)
    0x18cb, 0x18cd, 0x18ce, 0x08ff, 0x0ab6,
  ], "step boundaries");
});

test("loc_189e MUTATION: `call 0x1a32` mis-charged 11T (not 17T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a32 ? 11 : c);
  loc_189e(m);
  assert.equal(m.tstates, 206, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 212, "golden T-state total catches the mutant");
});
