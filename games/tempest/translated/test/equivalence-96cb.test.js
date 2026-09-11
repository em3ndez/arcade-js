// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_96cb (ROM 0x96cb-0x96da) -- (0x2c),y delta walk, re-index, advance by 2.
// Run: node --test games/tempest/translated/test/equivalence-96cb.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_96cb } from "../loc_96cb.js";

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

test("loc_96cb: A = (2c),y ; delta = A - (2c),y-1 ; Y = Y + delta + 2", () => {
  const m = makeMachine();
  m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x4000);
  m.regs.y = 0x08;
  m.mem.write8(0x3008, 0x20); // (2c),y
  m.mem.write8(0x3007, 0x05); // (2c),y-1 (after dey)
  loc_96cb(m);
  // lda=0x20; dey->y=7; sbc 0x05 (C=1) -> 0x1b -> $29; tya(a=7); sec; adc $29 (=7+0x1b+carry) = 0x23; tay; iny iny -> 0x25
  assert.equal(m.mem.read8(0x29), 0x1b, "$29 = delta 0x20-0x05");
  assert.equal(m.regs.y, 0x25, "Y = 7 + 0x1b + carry + 2");
  assert.equal(m.pc, 0x4001, "rts");
  assert.equal(m.cycles, 5 + 2 + 2 + 5 + 3 + 2 + 2 + 3 + 2 + 2 + 2 + 6, "in-page cycle total");
});
