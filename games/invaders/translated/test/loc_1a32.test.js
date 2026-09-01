// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1a32 (ROM 0x1a32-0x1a3a): block copy B bytes (DE)->(HL), then ret.
// Run: node --test games/invaders/translated/test/loc_1a32.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1a32 } from "../loc_1a32.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_1a32: copies 2 bytes DE->HL, ret; 88 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.b = 0x02;
  m.regs.de = 0x2100;
  m.regs.hl = 0x2200;
  m.ram[0x2100] = 0xaa;
  m.ram[0x2101] = 0xbb;

  loc_1a32(m);

  assert.equal(m.mem.read8(0x2200), 0xaa, "dest[0] := src[0]");
  assert.equal(m.mem.read8(0x2201), 0xbb, "dest[1] := src[1]");
  assert.equal(m.regs.hl, 0x2202, "HL advanced past the copy");
  assert.equal(m.regs.de, 0x2102, "DE advanced past the source");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.a, 0xbb, "A holds the last byte copied");
  assert.equal(m.tstates, 39 + 39 + 10, "T total: 2 passes (39 each) + ret");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, CALLER_RET, "ret pops the caller return addr");
  assert.equal(m.regs.sp, 0x2400, "SP balanced");
});

test("loc_1a32 MUTATION: `ldax d` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.b = 0x02;
  m.regs.de = 0x2100;
  m.regs.hl = 0x2200;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a33 ? 4 : c); // 0x1a33 is the addr AFTER ldax d
  loc_1a32(m);
  assert.notEqual(m.tstates, 88, "golden T-state total catches the mutant");
});
