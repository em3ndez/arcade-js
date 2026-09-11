// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9c17 (ROM 0x9c17-0x9c20) -- $010b = 0xa0f8[$010b], rts.
// Run: node --test games/tempest/translated/test/equivalence-9c17.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9c17 } from "../loc_9c17.js";

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

test("loc_9c17: $010b = 0xa0f8[$010b], rts", () => {
  const m = makeMachine(); m.push16(0x4000);
  m.mem.write8(0x010b, 0x03); m.mem.write8(0xa0f8 + 3, 0x2a);
  loc_9c17(m);
  assert.equal(m.mem.read8(0x010b), 0x2a, "$010b = table[3]");
  assert.equal(m.regs.y, 0x03, "Y = old $010b");
  assert.equal(m.pc, 0x4001, "rts");
  assert.equal(m.cycles, 4 + 4 + 4 + 6, "ldy abs 4 + lda abs,y 4 + sta abs 4 + rts 6");
});

test("loc_9c17: page-cross when $010b index makes 0xa0f8,y cross to 0xa1xx", () => {
  const m = makeMachine(); m.push16(0x4000);
  m.mem.write8(0x010b, 0x10); m.mem.write8(0xa108, 0x99); // 0xa0f8+0x10=0xa108, crosses
  loc_9c17(m);
  assert.equal(m.mem.read8(0x010b), 0x99);
  assert.equal(m.cycles, 4 + 5 + 4 + 6, "lda abs,y +1 page cross");
});
