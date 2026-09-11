// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aa9e (ROM 0xaa9e). Author-derived minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-aa9e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aa9e } from "../loc_aa9e.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(addr) { this.calls.push(addr); this.pc = addr; return addr; },
  };
}

test("loc_aa9e: inx, stx $61, set ptr $61/y=1, tail jmp loc_dfb1", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x05;

  loc_aa9e(m);

  assert.equal(m.regs.x, 0x06, "inx");
  assert.equal(m.mem.read8(0x61), 0x06, "stx $61");
  assert.equal(m.regs.a, 0x61, "lda #$61");
  assert.equal(m.regs.y, 0x01, "ldy #$01");
  assert.deepEqual(m.calls, [0xdfb1], "tail jmp");
  assert.equal(m.pc, 0xdfb1);
  assert.equal(m.cycles, 12, "2+3+2+2+3");
});

test("loc_aa9e: inx wraps 0xff -> 0x00", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0xff;

  loc_aa9e(m);

  assert.equal(m.regs.x, 0x00, "inx wraps");
  assert.equal(m.mem.read8(0x61), 0x00, "stx $61 = 0");
});
