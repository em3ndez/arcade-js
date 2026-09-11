// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9025 (ROM 0x9025-0x902a) -- jsr 0x921b, jsr 0x92c5, then falls into loc_902b.
// Minimal 6502 harness; the call stub records targets and rebalances the JSR push. Run:
//   node --test games/tempest/translated/test/equivalence-9025.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9025 } from "../loc_9025.js";

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

test("loc_9025: calls 0x921b then 0x92c5 then falls into loc_902b; 12 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  loc_9025(m);
  assert.deepEqual(m.calls, [0x921b, 0x92c5, 0x902b], "jsr 0x921b, jsr 0x92c5, fall-through to loc_902b");
  assert.equal(m.pc, 0x902b, "last step landed at the fall-through entry 0x902b");
  assert.equal(m.regs.s, 0xfd, "both JSR pushes rebalanced by the call stub");
  assert.equal(m.cycles, 6 + 6, "jsr(6) + jsr(6); the fall-through call charges no step");
});

test("loc_9025 MUTATION: a mischarged JSR blows the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x9028 ? 7 : c); // first jsr step
  loc_9025(m);
  assert.notEqual(m.cycles, 12, "a 7T jsr would break the golden total");
});
