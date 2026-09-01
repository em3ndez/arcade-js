// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1931 (ROM 0x1931-0x193b): read a 4-byte descriptor at HL into DE (word),
// A, then a byte; final HL=(last<<8)|A; tail-delegate to loc_09ad.
//
// Run: node --test games/invaders/translated/test/loc_1931.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1931 } from "../loc_1931.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1931: unpacks descriptor, delegates to loc_09ad; 58 T", () => {
  const m = makeMachine();
  m.regs.hl = 0x2100;
  m.mem.write8(0x2100, 0x11); // -> E
  m.mem.write8(0x2101, 0x22); // -> D
  m.mem.write8(0x2102, 0x33); // -> A
  m.mem.write8(0x2103, 0x44); // -> H, then L := A

  loc_1931(m);

  assert.equal(m.regs.de, 0x2211, "DE := (D=0x22,E=0x11)");
  assert.equal(m.regs.a, 0x33, "A := (0x2102)");
  assert.equal(m.regs.hl, 0x4433, "HL := (H=0x44)<<8 | (L=A=0x33)");
  assert.equal(m.tstates, 7 + 5 + 7 + 5 + 7 + 5 + 7 + 5 + 10, "T: mov/inx x3 + mov h,m + mov l,a + jmp");
  assert.equal(m.pc, 0x09ad, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x09ad], "tail-delegates to loc_09ad");
  assert.deepEqual(m.pcSeq, [0x1932, 0x1933, 0x1934, 0x1935, 0x1936, 0x1937, 0x1938, 0x1939, 0x09ad], "step boundaries");
});

test("loc_1931 MUTATION: mov l,a dropped (L stays 0x03 from the last inx) is caught", () => {
  const m = makeMachine();
  m.regs.hl = 0x2100;
  m.mem.write8(0x2100, 0x11); m.mem.write8(0x2101, 0x22);
  m.mem.write8(0x2102, 0x33); m.mem.write8(0x2103, 0x44);
  loc_1931(m);
  assert.notEqual(m.regs.hl, 0x4403, "the golden HL==0x4433 catches a dropped mov l,a");
});
