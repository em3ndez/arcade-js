// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_96c7 / loc_96c8 (ROM 0x96c7-0x96ca) -- advance Y by 3 or 2 then rts.
// Run: node --test games/tempest/translated/test/equivalence-96c7.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_96c7, loc_96c8 } from "../loc_96c7.js";

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

test("loc_96c7: Y += 3, rts (three iny @2 + rts @6)", () => {
  const m = makeMachine(); m.push16(0x2000); m.regs.y = 0x10;
  loc_96c7(m);
  assert.equal(m.regs.y, 0x13, "Y advanced by 3");
  assert.equal(m.pc, 0x2001, "rts");
  assert.equal(m.cycles, 2 + 2 + 2 + 6);
});

test("loc_96c8: Y += 2, rts (two iny + rts)", () => {
  const m = makeMachine(); m.push16(0x2000); m.regs.y = 0xfe;
  loc_96c8(m);
  assert.equal(m.regs.y, 0x00, "0xfe + 2 wraps to 0x00");
  assert.equal(m.regs.fZ, true, "iny to 0 sets Z");
  assert.equal(m.cycles, 2 + 2 + 6);
});
