// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1439 (ROM 0x1439-0x1446): copy a vertical tile column from the [DE]
// stream into [HL], advancing HL by 0x20 (one row) per pass, B rows. No internal call, so a
// pre-seated caller return is popped cleanly by the final ret.
//
// Run: node --test games/invaders/translated/test/loc_1439.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1439 } from "../loc_1439.js";

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

test("loc_1439: copies 2 bytes from [DE] into [HL] with 0x20 row stride; 160 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x0200; // B=2 rows
  m.regs.hl = 0x9000; // dest column
  m.regs.de = 0x2000; // source stream
  m.mem.write8(0x2000, 0xaa);
  m.mem.write8(0x2001, 0xbb);

  loc_1439(m);

  assert.equal(m.mem.read8(0x9000), 0xaa, "row0 copied");
  assert.equal(m.mem.read8(0x9020), 0xbb, "row1 copied");
  assert.equal(m.regs.hl, 0x9040, "HL advanced 0x20 twice");
  assert.equal(m.regs.de, 0x2002, "DE consumed 2 source bytes");
  assert.equal(m.regs.b, 0x00, "row counter B ran to 0");
  assert.equal(m.regs.a, 0xbb, "A holds the last byte copied");
  assert.equal(m.tstates, 75 + 75 + 10, "2*(loop body) + ret");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, CALLER_RET, "final ret returns to the caller");
});

test("loc_1439 MUTATION: flipped source byte breaks the golden write assertion", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x0200;
  m.regs.hl = 0x9000;
  m.regs.de = 0x2000;
  m.mem.write8(0x2000, 0xaa);
  m.mem.write8(0x2001, 0x00); // mutant: was 0xbb
  loc_1439(m);
  assert.notEqual(m.mem.read8(0x9020), 0xbb, "the golden copy assertion catches the mutant");
});
