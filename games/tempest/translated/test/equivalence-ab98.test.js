// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ab98 (ROM 0xab98). Author-derived minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-ab98.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ab98 } from "../loc_ab98.js";

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

test("loc_ab98: stashes x/a, zeroes $2b, tail-enters loc_ab17 body at 0xab3b", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x07;
  m.regs.a = 0x33;

  loc_ab98(m);

  assert.equal(m.mem.read8(0x35), 0x07, "stx $35");
  assert.equal(m.mem.read8(0x2a), 0x33, "sta $2a");
  assert.equal(m.mem.read8(0x2b), 0x00, "sta $2b = 0");
  assert.equal(m.regs.a, 0x00, "lda #$00");
  assert.deepEqual(m.calls, [0xab3b], "beq tail into loc_ab17 body");
  assert.equal(m.pc, 0xab3b);
  assert.equal(m.cycles, 14, "3+3+2+3+3");
});
