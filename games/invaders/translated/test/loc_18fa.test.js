// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_18fa (ROM 0x18fa-0x1903): OR B into (0x2094), store back, mirror to
// OUT port 3. Pins the memory write, the port write, register/T totals.
//
// Run: node --test games/invaders/translated/test/loc_18fa.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_18fa } from "../loc_18fa.js";

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
  const io = { out: [], portOut(port, v) { this.out.push([port, v & 0xff]); } };
  return {
    regs, mem, ram, io, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_18fa: (0x2094) |= B, OUT 03, returns; 50 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2094, 0x30);
  m.regs.b = 0x0c;

  loc_18fa(m);

  assert.equal(m.regs.a, 0x3c, "A: 0x30 | 0x0c");
  assert.equal(m.mem.read8(0x2094), 0x3c, "(0x2094) := 0x3c");
  assert.deepEqual(m.io.out, [[0x03, 0x3c]], "OUT 03 <- A (0x3c)");
  assert.equal(m.tstates, 13 + 4 + 13 + 10 + 10, "T: lda+ora+sta+out+ret");
  assert.equal(m.pc, CALLER_RET, "final ret to caller");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.deepEqual(m.pcSeq, [0x18fd, 0x18fe, 0x1901, 0x1903, CALLER_RET], "step boundaries");
});

test("loc_18fa MUTATION: OUT dropped is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x2094, 0x30);
  m.regs.b = 0x0c;
  loc_18fa(m);
  assert.notEqual(m.io.out.length, 0, "the golden OUT assertion catches a dropped port write");
});
