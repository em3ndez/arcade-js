// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_921b (ROM 0x921b-0x9233) -- constant seeds then rts. Run:
//   node --test games/tempest/translated/test/equivalence-921b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_921b } from "../loc_921b.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}

test("loc_921b: seeds $0200,$51,$0106,$0201,$0202 and returns; 35 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  loc_921b(m);
  assert.equal(m.mem.read8(0x0200), 0x0e, "$0200 = 0x0e");
  assert.equal(m.mem.read8(0x51), 0xf0, "$51 = 0xf0");
  assert.equal(m.mem.read8(0x0106), 0x00, "$0106 = 0x00");
  assert.equal(m.mem.read8(0x0201), 0x0f, "$0201 = 0x0f");
  assert.equal(m.mem.read8(0x0202), 0x10, "$0202 = 0x10");
  assert.equal(m.regs.a, 0x10, "A left holding the last immediate 0x10");
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.equal(m.cycles, 2 + 4 + 2 + 3 + 2 + 4 + 2 + 4 + 2 + 4 + 6, "35 T");
});
