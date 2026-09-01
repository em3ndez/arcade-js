// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_147c (ROM 0x147c-0x1490): block-copy C bytes per row from [HL] to [DE],
// B rows, row base advancing by 0x20. Exercises the nested loop (2 rows x 2 bytes). No internal
// call, so a pre-seated caller return is popped by the final ret.
//
// Run: node --test games/invaders/translated/test/loc_147c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_147c } from "../loc_147c.js";

const CALLER_RET = 0xc0de;

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

test("loc_147c: copies 2 rows x 2 bytes, 0x20 row stride on source & dest; 320 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x0202; // B=2 rows, C=2 bytes/row
  m.regs.hl = 0x3000; // source base
  m.regs.de = 0x4000; // dest (contiguous)
  m.mem.write8(0x3000, 0x11); m.mem.write8(0x3001, 0x22);
  m.mem.write8(0x3020, 0x33); m.mem.write8(0x3021, 0x44);

  loc_147c(m);

  assert.equal(m.mem.read8(0x4000), 0x11, "row0 byte0");
  assert.equal(m.mem.read8(0x4001), 0x22, "row0 byte1");
  assert.equal(m.mem.read8(0x4002), 0x33, "row1 byte0");
  assert.equal(m.mem.read8(0x4003), 0x44, "row1 byte1");
  assert.equal(m.regs.hl, 0x3040, "source base advanced 0x20 twice");
  assert.equal(m.regs.de, 0x4004, "dest advanced 4 bytes");
  assert.equal(m.regs.b, 0x00, "row counter B ran to 0");
  assert.equal(m.regs.c, 0x02, "C restored from the pushed BC on the last row");
  assert.equal(m.tstates, 155 + 155 + 10, "2*(outer+inner) + ret");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, CALLER_RET, "final ret returns to caller");
});

test("loc_147c MUTATION: inner `stax d` mis-charged 5T (not 7T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x0202;
  m.regs.hl = 0x3000;
  m.regs.de = 0x4000;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1480 ? 5 : c); // stax d lands at 0x1480
  loc_147c(m);
  assert.notEqual(m.tstates, 320, "golden T-state total catches the mutant");
});
