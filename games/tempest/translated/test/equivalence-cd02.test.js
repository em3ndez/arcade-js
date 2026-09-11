// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_cd02 (ROM 0xcd02) -- lda #$3f then BNE $ccc3 (always taken). Author-derived harness.
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_cd02 } from "../loc_cd02.js";

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

test("loc_cd02: A=0x3f, BNE always taken -> tail-call loc_ccc3; 6 T", () => {
  const m = makeMachine();
  loc_cd02(m);
  assert.equal(m.regs.a, 0x3f, "A = 0x3f");
  assert.equal(m.regs.fZ, false, "0x3f -> Z clear (BNE taken)");
  assert.equal(m.regs.fN, false, "0x3f -> N clear");
  assert.equal(m.pc, 0xccc3, "tail-jump target loc_ccc3");
  assert.deepEqual(m.calls, [0xccc3], "tail-call loc_ccc3");
  assert.equal(m.cycles, 2 + 4, "lda imm (2) + bne taken cross-page cd06->ccc3 (4)");
});

test("loc_cd02 MUTATION: mischarging the cross-page BNE as 3T breaks the golden total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xccc3 ? 3 : c);
  loc_cd02(m);
  assert.notEqual(m.cycles, 6, "dropping the page-cross +1 breaks the total");
});
