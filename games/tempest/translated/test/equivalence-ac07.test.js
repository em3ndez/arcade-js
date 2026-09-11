// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_ac07 (ROM 0xac07) -- bare rts. Minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-ac07.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_ac07 } from "../loc_ac07.js";

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

test("loc_ac07: rts -> pushed+1, 6 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x4200); // rts -> 0x4201

  loc_ac07(m);

  assert.equal(m.pc, 0x4201, "rts returns to pushed + 1");
  assert.equal(m.cycles, 6, "rts = 6 T");
  assert.deepEqual(m.calls, [], "no subroutines");
});
