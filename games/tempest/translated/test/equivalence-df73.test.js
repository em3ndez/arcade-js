// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df73 (ROM 0xdf73-0xdf74). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-df73.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df73 } from "../loc_df73.js";

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

test("loc_df73: sty $73, fall into 0xdf75; 3 T", () => {
  const m = makeMachine();
  m.regs.y = 0x2a;
  m.ram[0x0073] = 0x00;

  loc_df73(m);

  assert.equal(m.ram[0x0073], 0x2a, "Y stored into $73");
  assert.deepEqual(m.calls, [0xdf75], "fall-through delegates to loc_df75");
  assert.equal(m.pc, 0xdf75, "PC at fall-through entry");
  assert.equal(m.cycles, 3, "3 T (sty zp)");
});
