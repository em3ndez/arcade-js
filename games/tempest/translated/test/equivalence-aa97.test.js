// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aa97 (ROM 0xaa97). Author-derived minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-aa97.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aa97 } from "../loc_aa97.js";

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

test("loc_aa97: a=0, jsr loc_b0dd, x=$3d, fall through into loc_aa9e", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x3d, 0x09);

  loc_aa97(m);

  assert.equal(m.regs.a, 0x00, "lda #$00");
  assert.equal(m.regs.x, 0x09, "ldx $3d");
  assert.deepEqual(m.calls, [0xb0dd, 0xaa9e], "jsr then fall-through delegate");
  assert.equal(m.pc, 0xaa9e, "falls into loc_aa9e");
  assert.equal(m.cycles, 11, "2 + 6 + 3");
});
