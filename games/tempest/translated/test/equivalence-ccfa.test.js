// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ccfa (ROM 0xccfa). Trampoline: lda #0xaf then BNE (always taken, A nonzero) tail-
// jumps to loc_ccc7. Minimal 6502 harness (Regs + flat RAM + page-1 stack seam), author-derived; the whole-
// machine boot-first state diff vs MAME is the integration check. Run: node --test .../equivalence-ccfa.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ccfa } from "../loc_ccfa.js";

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

test("loc_ccfa: A=0xaf, BNE always taken -> tail-call loc_ccc7; 5 T", () => {
  const m = makeMachine();
  loc_ccfa(m);
  assert.equal(m.regs.a, 0xaf, "A = 0xaf");
  assert.equal(m.regs.fZ, false, "0xaf -> Z clear (BNE taken)");
  assert.equal(m.regs.fN, true, "0xaf -> N set");
  assert.equal(m.pc, 0xccc7, "tail-jump target loc_ccc7");
  assert.deepEqual(m.calls, [0xccc7], "tail-call to loc_ccc7, no return pushed");
  assert.equal(m.cycles, 2 + 3, "lda imm (2) + bne taken same-page (3)");
});

test("loc_ccfa MUTATION: mischarging the BNE as 4T (phantom page cross) blows the total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0xccc7 ? 4 : c);
  loc_ccfa(m);
  assert.notEqual(m.cycles, 5, "a mischarged BNE cycle breaks the golden T-state total");
});
