// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_db88 (ROM 0xdb88-0xdb99). Minimal 6502 harness (Regs + flat RAM + page-1 stack
// seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-db88.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_db88 } from "../loc_db88.js";

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

test("loc_db88: jsr 0xdf39, zero $60c1/$60d1,x for x=6,4,2,0, rts; 83 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  // pre-fill the whole $60c0..$60d8 window nonzero to prove exactly the even offsets are cleared.
  for (let a = 0x60c0; a <= 0x60d8; a++) m.ram[a] = 0xaa;

  loc_db88(m);

  assert.deepEqual(m.calls, [0xdf39], "jsr 0xdf39 recorded, stack balanced");
  // cleared: 0x60c1+x and 0x60d1+x for x in {6,4,2,0}
  for (const x of [6, 4, 2, 0]) {
    assert.equal(m.ram[0x60c1 + x], 0x00, `$60c1+${x} cleared`);
    assert.equal(m.ram[0x60d1 + x], 0x00, `$60d1+${x} cleared`);
  }
  // odd offsets (x=5,3,1) never touched
  assert.equal(m.ram[0x60c6], 0xaa, "$60c6 (odd x=5) untouched");
  assert.equal(m.ram[0x60c2], 0xaa, "$60c2 (odd x=1) untouched");
  assert.equal(m.regs.x, 0xfe, "X ends at 0xfe (-2)");
  assert.equal(m.regs.a, 0x00, "A held 0x00");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.equal(m.cycles, 6 + 2 + 2 + (17 * 3) + 16 + 6, "83 T");
});
