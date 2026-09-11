// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aba2 (ROM 0xaba2). Author-derived minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-aba2.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aba2 } from "../loc_aba2.js";

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

test("loc_aba2: jsr loc_ac20; $01c9 & 3 == 0 -> tail beq loc_ac07", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x01c9, 0x04); // & 3 == 0

  loc_aba2(m);

  assert.equal(m.regs.a, 0x00, "and #$03 -> 0");
  assert.deepEqual(m.calls, [0xac20, 0xac07], "jsr then taken-branch tail");
  assert.equal(m.pc, 0xac07);
  assert.equal(m.cycles, 16, "6 + 4 + 2 + 4 (branch taken, +1 page cross)");
});

test("loc_aba2: $01c9 & 3 != 0 -> fall through to loc_abac", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x01c9, 0x05); // & 3 == 1

  loc_aba2(m);

  assert.equal(m.regs.a, 0x01, "and #$03 -> 1");
  assert.deepEqual(m.calls, [0xac20, 0xabac], "jsr then fall-through delegate");
  assert.equal(m.pc, 0xabac);
  assert.equal(m.cycles, 14, "6 + 4 + 2 + 2 (branch not taken)");
});
