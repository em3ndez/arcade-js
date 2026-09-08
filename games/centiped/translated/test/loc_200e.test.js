// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_200e (ROM 0x200e-0x2015). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_200e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_200e } from "../loc_200e.js";

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

test("loc_200e: JSR $2872, CLI, JSR $2d5c, then runs into $2015; 14 T", () => {
  const m = makeMachine();
  m.regs.sei(); // I set on entry, CLI must clear it

  loc_200e(m);

  assert.equal(m.regs.fI, false, "CLI cleared the interrupt-disable flag");
  assert.equal(m.cycles, 6 + 2 + 6, "14 T");
  assert.equal(m.pc, 0x2015, "falls through to the $2015 loop");
  assert.deepEqual(m.calls, [0x2872, 0x2d5c, 0x2015], "two JSRs then the fall-through to $2015");
});

test("loc_200e MUTATION: CLI mischarged 3T not 2T is caught by the T-state total", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2012 ? 3 : c); // CLI steps to 0x2012
  loc_200e(m);
  assert.notEqual(m.cycles, 14, "a mischarged cycle blows the golden T-state total");
});
