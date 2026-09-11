// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9a87 (ROM 0x9a87) -- `txa` then falls through into loc_9a88. Minimal 6502
// harness (Regs + flat RAM + page-1 stack seam), author-derived; the whole-machine boot-first state diff
// vs MAME is the integration check. Run: node --test games/tempest/translated/test/equivalence-9a87.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9a87 } from "../loc_9a87.js";

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

test("loc_9a87: txa copies X->A, sets N/Z, then delegates to loc_9a88; 2 T", () => {
  const m = makeMachine();
  m.regs.x = 0x80;
  loc_9a87(m);
  assert.equal(m.regs.a, 0x80, "A = X");
  assert.equal(m.regs.fN, true, "0x80 -> N set");
  assert.equal(m.regs.fZ, false, "0x80 -> Z clear");
  assert.deepEqual(m.calls, [0x9a88], "falls through into loc_9a88");
  assert.equal(m.pc, 0x9a88, "PC at loc_9a88");
  assert.equal(m.cycles, 2, "txa = 2 T");
});

test("loc_9a87: X=0 -> A=0, Z set", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  loc_9a87(m);
  assert.equal(m.regs.a, 0x00, "A = 0");
  assert.equal(m.regs.fZ, true, "Z set");
  assert.equal(m.regs.fN, false, "N clear");
});
