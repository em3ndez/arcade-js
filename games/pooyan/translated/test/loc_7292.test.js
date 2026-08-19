// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7292 (ROM 0x7292-0x729f): eagle-phase reset epilogue.
//
// Run: node --test games/pooyan/translated/test/loc_7292.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7292 } from "../loc_7292.js";

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
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_7292: clears (0x8a87)/(0x8f5b)/(0x8f39), advances (0x8f38), ret; 74 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a87, 0x99);
  m.mem.write8(0x8f5b, 0x99);
  m.mem.write8(0x8f38, 0x00);
  m.mem.write8(0x8f39, 0x99);

  loc_7292(m);

  assert.equal(m.tstates, 4 + 13 + 13 + 10 + 11 + 6 + 7 + 10, "74 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8a87), 0x00, "anim flag cleared");
  assert.equal(m.mem.read8(0x8f5b), 0x00, "latched X cleared");
  assert.equal(m.mem.read8(0x8f38), 0x01, "phase advanced");
  assert.equal(m.mem.read8(0x8f39), 0x00, "sub-phase cleared");
  assert.deepEqual(m.pcSeq, [0x7293, 0x7296, 0x7299, 0x729c, 0x729d, 0x729e, 0x729f, CALLER_RET], "boundaries");
});

test("loc_7292 MUTATION: inc (hl) at 0x729c mischarged 6T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x729d ? 6 : c);
  loc_7292(m);
  assert.notEqual(m.tstates, 74, "golden 74 T catches the mischarge");
});
