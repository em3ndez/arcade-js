// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2cea (ROM 0x2cea-0x2cee). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_2cea.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2cea } from "../loc_2cea.js";

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

// A=0x0e: CMP #$0e sets carry, then JMP $2cc2 (m.call) whose opening branch consumes that carry.
function setup() {
  const m = makeMachine();
  m.regs.a = 0x0e;
  return m;
}

test("loc_2cea: CMP #$0e sets carry, JMP $2cc2; 5 T", () => {
  const m = setup();
  loc_2cea(m);

  assert.equal(m.regs.fC, true, "C set (0x0e >= 0x0e)");
  assert.equal(m.regs.fZ, true, "Z set (0x0e == 0x0e)");
  assert.equal(m.cycles, 5, "2 (CMP) + 3 (JMP)");
  assert.equal(m.pc, 0x2cc2, "PC at the jump target");
  assert.deepEqual(m.calls, [0x2cc2], "JMP $2cc2 -> m.call(0x2cc2)");
  assert.deepEqual(m.pcSeq, [0x2cec, 0x2cc2], "CMP then JMP step boundaries");
});

test("loc_2cea MUTATION: JMP $2cc2 mischarged 2T not 3T is caught by the T-state total", () => {
  const m = setup();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x2cc2 ? 2 : c); // only JMP steps to 0x2cc2
  loc_2cea(m);
  assert.notEqual(m.cycles, 5, "a mischarged cycle blows the golden T-state total");
});
