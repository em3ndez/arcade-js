// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c97b (ROM 0xc97b-0xc98b) -- seeds $00-$04 then rts.
// Run: node --test games/tempest/translated/test/equivalence-c97b.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c97b } from "../loc_c97b.js";

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

test("loc_c97b: seeds $00=0x0a $01=0x00 $02=0x04 $04=0x14, rts", () => {
  const m = makeMachine();
  m.push16(0x1234);
  m.mem.write8(0x00, 0xee); m.mem.write8(0x01, 0xee); m.mem.write8(0x02, 0xee);
  m.mem.write8(0x03, 0xee); m.mem.write8(0x04, 0xee); // pre-fill to prove the stores
  loc_c97b(m);
  assert.equal(m.mem.read8(0x00), 0x0a, "$00 = 0x0a");
  assert.equal(m.mem.read8(0x01), 0x00, "$01 = 0x00");
  assert.equal(m.mem.read8(0x02), 0x04, "$02 = 0x04");
  assert.equal(m.mem.read8(0x03), 0xee, "$03 untouched");
  assert.equal(m.mem.read8(0x04), 0x14, "$04 = 0x14");
  assert.equal(m.regs.a, 0x14, "A = last loaded immediate");
  assert.equal(m.pc, 0x1235, "rts -> pushed return + 1");
  assert.equal(m.cycles, 2 + 3 + 2 + 3 + 2 + 3 + 2 + 3 + 6, "4x (lda#imm 2 + sta zp 3) + rts 6 = 26");
});
