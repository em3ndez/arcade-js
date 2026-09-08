// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3037 (ROM 0x3037-0x303e). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3037.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3037 } from "../loc_3037.js";

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

test("loc_3037: STY $8b, A:=0, JSR $2db6, falls into loc_303e; 11 T", () => {
  const m = makeMachine();
  m.regs.y = 0x37;
  m.regs.a = 0x99; // will be cleared

  loc_3037(m);

  assert.equal(m.ram[0x008b], 0x37, "$8b = Y");
  assert.equal(m.regs.a, 0x00, "A cleared by LDA #$00");
  assert.equal(m.regs.fZ, true, "Z set (A = 0)");
  assert.equal(m.regs.fN, false, "N clear");
  assert.equal(m.cycles, 3 + 2 + 6, "11 T");
  assert.deepEqual(m.calls, [0x2db6, 0x303e], "JSR $2db6 then fall into loc_303e");
  assert.deepEqual(m.pcSeq, [0x3039, 0x303b, 0x303e], "step boundaries");
  assert.equal(m.pc, 0x303e, "pc at the loc_303e boundary");
});

test("loc_3037 MUTATION: JSR mischarged 5T not 6T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.y = 0x37;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x303e ? 5 : c); // the JSR step lands at 0x303e
  loc_3037(m);
  assert.notEqual(m.cycles, 11, "a mischarged cycle blows the golden T-state total");
});
