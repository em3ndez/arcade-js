// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_92ad (ROM 0x92ad-0x92b1) -- $50 = 0x00, rts. Run:
//   node --test games/tempest/translated/test/equivalence-92ad.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_92ad } from "../loc_92ad.js";

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

test("loc_92ad: $50 = 0x00, Z set, returns; 11 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x8000);
  m.ram[0x50] = 0x42;
  loc_92ad(m);
  assert.equal(m.mem.read8(0x50), 0x00, "$50 cleared");
  assert.equal(m.regs.a, 0x00, "A = 0x00");
  assert.equal(m.regs.fZ, true, "Z set from lda #0x00");
  assert.equal(m.pc, 0x8001, "rts -> pushed+1");
  assert.equal(m.cycles, 2 + 3 + 6, "lda imm(2) + sta zp(3) + rts(6) = 11");
});
