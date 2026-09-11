// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df75 (ROM 0xdf75) -- sign-extend+double A into $6e/$6f and X into $70/$71,
// then X=$6e; falls into loc_df92.
// Run: node --test games/tempest/translated/test/equivalence-df75.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df75 } from "../loc_df75.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_df75: A=0x40 (no dey), X=0xc0 (dey path), 45 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x40;  // asl -> 0x80 C=0 (bcc taken, Y stays 0); asl again -> 0x00 C=1; rol $6f -> 0x01
  m.regs.x = 0xc0;  // txa; asl -> 0x80 C=1 (bcc not taken, dey -> Y=0xff); asl -> 0x00 C=1; rol $71 -> 0xff

  loc_df75(m);

  assert.equal(m.mem.read8(0x6e), 0x00, "A doubled low byte");
  assert.equal(m.mem.read8(0x6f), 0x01, "A doubled high byte (sign 0, carry in)");
  assert.equal(m.mem.read8(0x70), 0x00, "X doubled low byte");
  assert.equal(m.mem.read8(0x71), 0xff, "X doubled high byte (sign extend 0xff, carry in)");
  assert.equal(m.regs.x, 0x6e, "X set to $6e pointer");
  assert.deepEqual(m.calls, [0xdf92], "falls into loc_df92");
  assert.equal(m.pc, 0xdf92);
  assert.equal(m.cycles, 45, "2+2+3 (bcc taken)+3+2+5+3 + 2+2+2+2 (bcc fall)+2 (dey)+3+2+5+3 + 2 (ldx)");
});
