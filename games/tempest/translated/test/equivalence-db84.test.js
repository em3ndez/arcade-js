// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_db84 (ROM 0xdb84). Minimal 6502 harness (Regs + flat RAM + page-1 stack +
// call recorder). Run: node --test games/tempest/translated/test/equivalence-db84.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_db84 } from "../loc_db84.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(target) { this.calls.push(target); this.pc = target; if (this._retPushed) { this._retPushed = false; this.pull16(); } },
  };
}

test("loc_db84: A=0x33/X=0x0a into df39, zeroes $60c1+even and $60d1+even, rts; 87 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000); // rts -> 0x3001
  m._retPushed = false;
  for (const off of [0, 2, 4, 6]) { m.ram[0x60c1 + off] = 0xee; m.ram[0x60d1 + off] = 0xee; }
  m.ram[0x60c1 + 1] = 0xee; // odd index must be left untouched (dex/dex skips it)

  loc_db84(m);

  assert.deepEqual(m.calls, [0xdf39], "jsr df39 once");
  for (const off of [0, 2, 4, 6]) {
    assert.equal(m.mem.read8(0x60c1 + off), 0x00, `$60c1+${off} cleared`);
    assert.equal(m.mem.read8(0x60d1 + off), 0x00, `$60d1+${off} cleared`);
  }
  assert.equal(m.mem.read8(0x60c1 + 1), 0xee, "odd index $60c2 left untouched by the even-step loop");
  assert.equal(m.pc, 0x3001, "rts to pushed + 1");
  assert.equal(m.cycles, 87, "computed total T (14 setup + 67 loop + 6 rts)");
});
