// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_db7e (ROM 0xdb7e). Minimal 6502 harness (Regs + flat RAM + call recorder).
// A=0x32 (constant) makes the bne always taken. Run: node --test games/tempest/translated/test/equivalence-db7e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_db7e } from "../loc_db7e.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(target) { this.calls.push(target); this.pc = target; if (this._retPushed) { this._retPushed = false; this.pull16(); } },
  };
}

test("loc_db7e: X=0xb6, A=0x32, bne to loc_db88; 7 T", () => {
  const m = makeMachine();
  m.regs.s = 0xff;

  loc_db7e(m);

  assert.equal(m.regs.x, 0xb6, "db7e ldx #0xb6");
  assert.equal(m.regs.a, 0x32, "db80 lda #0x32");
  assert.equal(m.regs.fZ, false, "Z clear -> bne taken");
  assert.deepEqual(m.calls, [0xdb88], "bne into loc_db88");
  assert.equal(m.pc, 0xdb88, "final PC at the branch target");
  assert.equal(m.cycles, 2 + 2 + 3, "7 T (ldx + lda + bne taken)");
});
