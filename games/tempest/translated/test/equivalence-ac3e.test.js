// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ac3e (ROM 0xac3e) -- a lone rts. Minimal 6502 harness (Regs + flat page-1
// stack). Run: node --test games/tempest/translated/test/equivalence-ac3e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ac3e } from "../loc_ac3e.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
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

test("loc_ac3e: rts returns to pushed + 1, 6 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> pulled + 1 = 0x1234
  loc_ac3e(m);
  assert.equal(m.pc, 0x1234, "rts returns to pushed + 1");
  assert.equal(m.cycles, 6, "rts = 6 T");
  assert.equal(m.regs.s, 0xfd, "stack pointer restored");
});
