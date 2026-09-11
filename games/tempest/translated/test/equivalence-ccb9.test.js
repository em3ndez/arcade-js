// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ccb9 (ROM 0xccb9) -- lda #$4f then BNE $ccc3 (always taken). Author-derived harness.
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ccb9 } from "../loc_ccb9.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; }, read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8) };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_ccb9: A=0x4f, BNE always taken -> tail-call loc_ccc3; 5 T", () => {
  const m = makeMachine();
  loc_ccb9(m);
  assert.equal(m.regs.a, 0x4f, "A = 0x4f");
  assert.equal(m.regs.fZ, false, "0x4f -> Z clear (BNE taken)");
  assert.equal(m.regs.fN, false, "0x4f -> N clear");
  assert.equal(m.pc, 0xccc3, "tail-jump target loc_ccc3");
  assert.deepEqual(m.calls, [0xccc3], "tail-call loc_ccc3");
  assert.equal(m.cycles, 2 + 3, "lda imm (2) + bne taken same-page (3)");
});

test("loc_ccb9 MUTATION: mischarging the BNE as 4T breaks the golden total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xccc3 ? 4 : c);
  loc_ccb9(m);
  assert.notEqual(m.cycles, 5, "a mischarged BNE cycle breaks the total");
});
