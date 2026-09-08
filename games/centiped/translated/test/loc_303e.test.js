// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_303e (ROM 0x303e-0x3046). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_303e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_303e } from "../loc_303e.js";

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

test("loc_303e: $b2=0x13, $34+X=0xff, then falls through into loc_3046; 11 T", () => {
  const m = makeMachine();
  m.regs.x = 0x05; // STA $34,X -> $39

  loc_303e(m);

  assert.equal(m.ram[0x00b2], 0x13, "$b2 seeded to 0x13");
  assert.equal(m.ram[0x0039], 0xff, "$34+X (=0x39) set to 0xff");
  assert.equal(m.regs.a, 0xff, "A left as 0xff by the second LDA");
  assert.equal(m.regs.x, 0x05, "X untouched");
  assert.equal(m.regs.fN, true, "N from A=0xff");
  assert.equal(m.regs.fZ, false, "Z clear");
  assert.equal(m.cycles, 2 + 3 + 2 + 4, "11 T");
  assert.equal(m.pc, 0x3046, "PC at the fall-through target 0x3046");
  assert.deepEqual(m.calls, [0x3046], "control continues into loc_3046");
});

test("loc_303e MUTATION: STA $34,X mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.x = 0x05;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3046 ? 5 : c); // the STA $34,X step lands at 0x3046
  loc_303e(m);
  assert.notEqual(m.cycles, 11, "a mischarged cycle blows the golden T-state total");
});
