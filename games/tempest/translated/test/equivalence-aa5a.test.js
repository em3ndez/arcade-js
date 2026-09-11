// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aa5a (ROM 0xaa5a). Author-derived minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-aa5a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aa5a } from "../loc_aa5a.js";

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

test("loc_aa5a: x=8, jsr loc_ab14, tail jmp into loc_aa62 at 0xaa69", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;

  loc_aa5a(m);

  assert.equal(m.regs.x, 0x08, "ldx #$08");
  assert.deepEqual(m.calls, [0xab14, 0xaa69], "jsr then tail jmp");
  assert.equal(m.pc, 0xaa69, "final PC at tail target");
  assert.equal(m.mem.read8(0x0100 | ((m.regs.s + 1) & 0xff)), 0x5e, "jsr pushed return low = 0xaa5e");
  assert.equal(m.cycles, 11, "2+6+3");
});
