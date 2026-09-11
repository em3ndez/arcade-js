// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ccc1 (ROM 0xccc1) -- lda #$1f then fall-through into loc_ccc3. Author-derived harness.
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ccc1 } from "../loc_ccc1.js";

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

test("loc_ccc1: A=0x1f, fall-through into loc_ccc3; 2 T", () => {
  const m = makeMachine();
  loc_ccc1(m);
  assert.equal(m.regs.a, 0x1f, "A = 0x1f");
  assert.equal(m.regs.fZ, false, "0x1f -> Z clear");
  assert.equal(m.regs.fN, false, "0x1f -> N clear");
  assert.equal(m.pc, 0xccc3, "fall-through into loc_ccc3");
  assert.deepEqual(m.calls, [0xccc3], "delegate to loc_ccc3, no return pushed");
  assert.equal(m.cycles, 2, "lda imm (2); the fall-through is not an instruction");
});

test("loc_ccc1 MUTATION: dropping the lda step (0T) breaks the golden total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xccc3 ? 0 : c);
  loc_ccc1(m);
  assert.notEqual(m.cycles, 2, "a mischarged lda cycle breaks the total");
});
