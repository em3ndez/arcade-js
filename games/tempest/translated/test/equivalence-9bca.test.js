// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9bca (ROM 0x9bca-0x9bcf) -- clears $010a, rts.
// Run: node --test games/tempest/translated/test/equivalence-9bca.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9bca } from "../loc_9bca.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  return {
    regs, mem, ram, cycles: 0, pc: 0,
    step(n, c) { this.pc = n; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_9bca: clears $010a, A=0/Z set, rts", () => {
  const m = makeMachine(); m.push16(0x4000);
  m.mem.write8(0x010a, 0x77);
  loc_9bca(m);
  assert.equal(m.mem.read8(0x010a), 0x00, "$010a cleared");
  assert.equal(m.regs.a, 0x00); assert.equal(m.regs.fZ, true, "lda #0 sets Z");
  assert.equal(m.pc, 0x4001, "rts");
  assert.equal(m.cycles, 2 + 4 + 6, "lda#0 2 + sta abs 4 + rts 6");
});
