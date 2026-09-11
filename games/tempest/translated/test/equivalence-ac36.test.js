// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ac36 (ROM 0xac36) -- `ora #$03` into $01c9. Minimal 6502 harness (Regs + flat
// RAM + the page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the
// integration check. Run: node --test games/tempest/translated/test/equivalence-ac36.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ac36 } from "../loc_ac36.js";

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

test("loc_ac36: $01c9 |= 0x03, N/Z from result, returns to pushed+1, 16 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> pulled + 1 = 0x1234
  m.mem.write8(0x01c9, 0x84);

  loc_ac36(m);

  assert.equal(m.mem.read8(0x01c9), 0x87, "0x84 | 0x03 = 0x87 written back");
  assert.equal(m.regs.a, 0x87, "A holds the result");
  assert.equal(m.regs.fN, true, "0x87 -> N set");
  assert.equal(m.regs.fZ, false, "0x87 -> Z clear");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 16, "4 (lda abs) + 2 (ora imm) + 4 (sta abs) + 6 (rts)");
});

test("loc_ac36: from 0x00 -> 0x03 (Z clear, N clear)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.mem.write8(0x01c9, 0x00);

  loc_ac36(m);

  assert.equal(m.mem.read8(0x01c9), 0x03, "0x00 | 0x03 = 0x03");
  assert.equal(m.regs.fZ, false, "0x03 -> Z clear");
  assert.equal(m.regs.fN, false, "0x03 -> N clear");
});
