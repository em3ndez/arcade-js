// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ccb0 (ROM 0xccb0) -- lda #$5f then JMP $ccc3. Author-derived harness.
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ccb0 } from "../loc_ccb0.js";

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

test("loc_ccb0: A=0x5f, JMP tail-call loc_ccc3; 5 T", () => {
  const m = makeMachine();
  loc_ccb0(m);
  assert.equal(m.regs.a, 0x5f, "A = 0x5f");
  assert.equal(m.regs.fZ, false, "0x5f -> Z clear");
  assert.equal(m.regs.fN, false, "0x5f -> N clear");
  assert.equal(m.pc, 0xccc3, "jmp target loc_ccc3");
  assert.deepEqual(m.calls, [0xccc3], "tail-call loc_ccc3, no return pushed");
  assert.equal(m.cycles, 2 + 3, "lda imm (2) + jmp abs (3)");
});

test("loc_ccb0 MUTATION: mischarging jmp as 4T breaks the golden total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xccc3 ? 4 : c);
  loc_ccb0(m);
  assert.notEqual(m.cycles, 5, "a mischarged jmp cycle breaks the total");
});
