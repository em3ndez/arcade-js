// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_00b1 (ROM 0x00b1-0x00d6): fetch a pointer via 0x0886, mirror it to
// 0x2009/0x200b, clamp the byte below it into 0x2008, and set the 0x200d flag. The mock records
// m.call targets rather than running them, so the final `ret` pops the internal call's return
// (0x00b4) -- a record-only artifact that the golden PC assertion pins.
//
// Run: node --test games/invaders/translated/test/loc_00b1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_00b1 } from "../loc_00b1.js";

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

// After 0x0886, HL points at 0x2100 -> pointer 0x1234; the byte below (0x20ff) is 0x03, so
// `dcr a` runs, 0x2008 := 0x02; that != 0xfe so 0x200d := 0x00. 188 T.
function seat(m) {
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2100;
  m.ram[0x2100] = 0x34; m.ram[0x2101] = 0x12; // little-endian pointer 0x1234
  m.ram[0x20ff] = 0x03; // byte below -> triggers the dcr-a arm
}

test("loc_00b1: mirrors pointer, clamps 0x2008, clears 0x200d; 188 T", () => {
  const m = makeMachine();
  seat(m);

  loc_00b1(m);

  assert.equal(m.mem.read16(0x2009), 0x1234, "0x2009 := pointer");
  assert.equal(m.mem.read16(0x200b), 0x1234, "0x200b := pointer");
  assert.equal(m.mem.read8(0x2008), 0x02, "0x2008 := 0x03 - 1 (dcr a arm)");
  assert.equal(m.mem.read8(0x200d), 0x00, "0x200d := 0 (byte != 0xfe)");
  assert.equal(m.regs.a, 0x00, "A ends 0 (mvi a,0x00; inr a skipped)");
  assert.equal(m.regs.hl, 0x20ff, "HL = pointer-source - 1 after dcx h");
  assert.equal(m.tstates, 188, "T total for the dcr-a / jnz-taken path");
  assert.deepEqual(m.calls, [0x0886], "one delegation to helper 0x0886");
  assert.equal(m.mem.read16(0x23fe), 0x00b4, "call 0x0886 pushes return 0x00b4");
  assert.equal(m.pc, 0x00b4, "record-only ret pops the internal call's return 0x00b4");
  assert.equal(m.regs.sp, 0x2400, "SP balanced (push+pop h, call push, final ret)");
});

test("loc_00b1 MUTATION: shld 0x2009 mis-charged 13T (a sta) not 16T is caught", () => {
  const m = makeMachine();
  seat(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x00bc ? 13 : c); // 0x00bc is the addr AFTER shld 0x2009
  loc_00b1(m);
  assert.notEqual(m.tstates, 188, "golden T-state total catches the mis-charged shld");
});
