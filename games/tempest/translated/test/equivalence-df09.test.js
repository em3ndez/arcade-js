// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df09 (ROM 0xdf09) -- A=0xc0 then bne into loc_df0d at $df12. Minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-df09.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df09 } from "../loc_df09.js";

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

test("loc_df09: A<-0xc0, bne taken tail-calls $df12, 5 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;

  loc_df09(m);

  assert.equal(m.regs.a, 0xc0, "A = 0xc0");
  assert.equal(m.regs.fN, true, "0xc0 -> N set");
  assert.equal(m.regs.fZ, false, "0xc0 -> Z clear (bne taken)");
  assert.deepEqual(m.calls, [0xdf12], "tail-calls loc_df12");
  assert.equal(m.pc, 0xdf12, "PC at branch target");
  assert.equal(m.cycles, 5, "2 (lda imm) + 3 (bne taken)");
});
