// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_96db (ROM 0x96db-0x96e1) -- (0x2c),y + base at $0160, rts.
// Run: node --test games/tempest/translated/test/equivalence-96db.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_96db } from "../loc_96db.js";

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

test("loc_96db: A = (2c),y + [$0160], rts", () => {
  const m = makeMachine();
  m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x5000);
  m.regs.y = 0x05; m.mem.write8(0x3005, 0x10); m.mem.write8(0x0160, 0x20);
  loc_96db(m);
  assert.equal(m.regs.a, 0x30, "0x10 + 0x20");
  assert.equal(m.pc, 0x5001, "rts");
  assert.equal(m.cycles, 5 + 2 + 4 + 6, "lda(zp),y 5 + clc 2 + adc abs 4 + rts 6");
});

test("loc_96db: clc clears any incoming carry (sum is exact, no +1)", () => {
  const m = makeMachine();
  m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x5000);
  m.regs.fC = true; // pre-set carry; the clc must clear it
  m.regs.y = 0x01; m.mem.write8(0x3001, 0x01); m.mem.write8(0x0160, 0x01);
  loc_96db(m);
  assert.equal(m.regs.a, 0x02, "0x01 + 0x01 with clc -> no stray +1");
});
