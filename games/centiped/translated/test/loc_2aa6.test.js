// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2aa6 (ROM 0x2aa6-0x2ac7). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2aa6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2aa6 } from "../loc_2aa6.js";

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

// X=0, $44=$74=0 (so BNE at 2aaf falls through and BMI at 2ab3 not taken -> the second $382d runs), $54=0x0A.
// $382d is a harness no-op, so A carries 0 into $74, then A=+4 (BPL taken, $44>=0) + $54 -> 0x0E. Falls into
// loc_2ac7. Author-derived cycle budget = 53 T.
function setup(m) {
  m.regs.x = 0;
  m.ram[0x44] = 0x00; m.ram[0x74] = 0x00; m.ram[0x54] = 0x0a;
}

test("loc_2aa6: folds +4 into $54+X and falls into loc_2ac7; 53 T", () => {
  const m = makeMachine();
  setup(m);

  loc_2aa6(m);

  assert.equal(m.ram[0x44], 0x00, "$44+X <- stepped $382d result (no-op = 0)");
  assert.equal(m.ram[0x74], 0x00, "$74+X <- 0");
  assert.equal(m.ram[0x54], 0x0e, "$54+X += 4 -> 0x0E");
  assert.equal(m.regs.a, 0x0e, "A holds the new $54+X");
  assert.equal(m.regs.fC, false, "C clear (0x04 + 0x0A no carry)");
  assert.equal(m.cycles, 53, "53 T total");
  assert.equal(m.pc, 0x2ac7, "no RTS: PC falls through to loc_2ac7");
  assert.deepEqual(m.calls, [0x382d, 0x382d, 0x2ac7], "two $382d steps, then tail-call into loc_2ac7");
});

test("loc_2aa6 MUTATION: the STA $54,X exit step mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2ac7 ? 5 : c); // the 2ac5 STA $54,X step lands at 0x2ac7 (once)
  loc_2aa6(m);
  assert.notEqual(m.cycles, 53, "a mischarged cycle blows the golden T-state total");
});
