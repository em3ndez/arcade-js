// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dd2b (ROM 0xdd2b-0xdd40). Author-derived 6502 harness; df75/df1f recorded.
// Run: node --test games/tempest/translated/test/equivalence-dd2b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dd2b } from "../loc_dd2b.js";

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

test("loc_dd2b: 8-pass asl/rol/emit loop over $35, jsr df75 once + df1f x8, rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000); // rts -> 0x3001
  m.regs.y = 0xc0; // sty $35

  loc_dd2b(m);

  assert.equal(m.mem.read8(0x0035), 0x00, "$35 shifted left 8 times -> 0");
  assert.equal(m.mem.read8(0x0037), 0xff, "$37 counted 7..0 then -1");
  assert.equal(m.regs.a, 0x00, "final rol a result (all bits shifted out)");
  assert.equal(m.regs.x, 0x07, "X preserved from ldx #$07");
  assert.equal(m.calls.length, 9, "df75 once + df1f eight times");
  assert.equal(m.calls[0], 0xdf75, "first call df75");
  assert.deepEqual(m.calls.slice(1), Array(8).fill(0xdf1f), "then df1f x8");
  assert.equal(m.pc, 0x3001, "rts -> pushed + 1");
  assert.equal(m.cycles, 203, "prologue 14 + 7*23 + 22 + rts 6");
});
