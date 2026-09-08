// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3fd6 (ROM 0x3fd6-0x3fd9). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3fd6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3fd6 } from "../loc_3fd6.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_3fd6: JMP $3d57 trampoline; 3 T; tail-dispatch to loc_3d57", () => {
  const m = makeMachine();
  loc_3fd6(m);
  assert.equal(m.pc, 0x3d57, "pc lands on the jump target");
  assert.equal(m.cycles, 3, "3 T for the absolute JMP");
  assert.deepEqual(m.calls, [0x3d57], "tail-jump dispatches loc_3d57");
  assert.deepEqual(m.pcSeq, [0x3d57], "single step to the target");
});

test("loc_3fd6 MUTATION: JMP mischarged 4T not 3T is caught by the T-state total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3d57 ? 4 : c);
  loc_3fd6(m);
  assert.notEqual(m.cycles, 3, "a mischarged cycle blows the golden T-state total");
});
