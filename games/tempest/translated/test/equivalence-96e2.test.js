// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_96e2 (ROM 0x96e2-0x96f3) -- jsr loc_96f4 for a count X, then add X copies of the
// next (0x2c),y to the first (0x2c),y. Run: node --test games/tempest/translated/test/equivalence-96e2.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_96e2 } from "../loc_96e2.js";
import { loc_96f4 } from "../loc_96f4.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  const routines = { 0x96f4: loc_96f4 };
  return {
    regs, mem, ram, cycles: 0, pc: 0,
    step(n, c) { this.pc = n; this.cycles += c; },
    call(t) { return routines[t](this); }, // dispatch the inner jsr 0x96f4
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_96e2: X copies of the 2nd entry added to the 1st (X from loc_96f4)", () => {
  const m = makeMachine();
  m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x6000);
  m.regs.y = 0x10; m.mem.write8(0x2b, 0x05);
  m.mem.write8(0x300e, 0x03); // loc_96f4: A = $2b(0x05) - [0x300e](0x03) = 0x02 -> X = 2
  m.mem.write8(0x3010, 0x01); // first (0x2c),y (y=0x10)
  m.mem.write8(0x3011, 0x10); // second (0x2c),y (y=0x11 after the iny) -- added X=2 times
  loc_96e2(m);
  assert.equal(m.regs.a, 0x01 + 0x10 + 0x10, "first + X*second");
  assert.equal(m.regs.x, 0x00, "X counted down to 0");
  assert.equal(m.pc, 0x6001, "rts");
});

test("loc_96e2: X==0 short-circuits (beq $96f3) -> A = first entry only", () => {
  const m = makeMachine();
  m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x6000);
  m.regs.y = 0x10; m.mem.write8(0x2b, 0x04);
  m.mem.write8(0x300e, 0x04); // loc_96f4: A = 0x04 - 0x04 = 0x00 -> X = 0
  m.mem.write8(0x3010, 0x2a);
  m.mem.write8(0x3011, 0xff); // must NOT be added
  loc_96e2(m);
  assert.equal(m.regs.a, 0x2a, "X==0 -> only the first entry, no loop");
  assert.equal(m.pc, 0x6001, "rts");
});
