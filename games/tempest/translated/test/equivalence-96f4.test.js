// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_96f4 / loc_9700 (ROM 0x96f4-0x970a). loc_96f4: $2b - (0x2c),y-2 into A, Y net
// unchanged. loc_9700: jsr loc_96f4, bump Y by the low bit, read (0x2c),y.
// Run: node --test games/tempest/translated/test/equivalence-96f4.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_96f4, loc_9700 } from "../loc_96f4.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  const routines = { 0x96f4: loc_96f4 };
  const m = {
    regs, mem, ram, cycles: 0, pc: 0,
    step(n, c) { this.pc = n; this.cycles += c; },
    call(t) { return routines[t](this); }, // dispatch the nested jsr for loc_9700
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
  return m;
}

test("loc_96f4: A = $2b - (0x2c),y-2 ; Y unchanged; rts", () => {
  const m = makeMachine();
  m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x1000);
  m.regs.y = 0x10; m.mem.write8(0x2b, 0x09); m.mem.write8(0x300e, 0x03); // (2c),y-2
  loc_96f4(m);
  assert.equal(m.regs.a, 0x06, "0x09 - 0x03");
  assert.equal(m.regs.y, 0x10, "dey dey then iny iny -> net unchanged");
  assert.equal(m.pc, 0x1001, "rts");
  assert.equal(m.cycles, 3 + 3 + 2 + 2 + 2 + 5 + 2 + 2 + 6, "in-page cycle total");
});

test("loc_9700: jsr loc_96f4, low-bit iny, read (0x2c),y", () => {
  const m = makeMachine();
  m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x2000);
  m.regs.y = 0x10; m.mem.write8(0x2b, 0x09); m.mem.write8(0x300e, 0x02); // loc_96f4 -> A = 0x09-0x02 = 0x07 (odd)
  m.mem.write8(0x3011, 0xaa); // (2c),y after one iny (0x07 low bit set)
  loc_9700(m);
  // A=0x07 -> and #1 = 1 (nonzero -> beq not taken -> iny -> y=0x11); read [0x3011]=0xaa
  assert.equal(m.regs.a, 0xaa, "final (0x2c),y read after the low-bit iny");
  assert.equal(m.regs.y, 0x11, "Y bumped by the odd low bit");
  assert.equal(m.pc, 0x2001, "rts");
});

test("loc_9700: even result skips the iny (beq taken)", () => {
  const m = makeMachine();
  m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x2000);
  m.regs.y = 0x10; m.mem.write8(0x2b, 0x0a); m.mem.write8(0x300e, 0x02); // A = 0x0a-0x02 = 0x08 (even)
  m.mem.write8(0x3010, 0x55);
  loc_9700(m);
  assert.equal(m.regs.y, 0x10, "even low bit -> no iny");
  assert.equal(m.regs.a, 0x55, "reads [0x3010]");
});
