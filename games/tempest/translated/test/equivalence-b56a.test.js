// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b56a (ROM 0xb56a-0xb585) -- writes 0,0,0,A at ($74), then advances $74/$75 by 4.
// Minimal 6502 harness (Regs + flat RAM + page-1 stack seam), author-derived. Run:
//   node --test games/tempest/translated/test/equivalence-b56a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b56a } from "../loc_b56a.js";

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

test("loc_b56a: no-carry advance -- writes 0,0,0,A and $74 += 4, 60 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.regs.a = 0x99;
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x30; // ptr = 0x3000

  loc_b56a(m);

  assert.equal(m.ram[0x3000], 0x00, "byte 0 = 0");
  assert.equal(m.ram[0x3001], 0x00, "byte 1 = 0");
  assert.equal(m.ram[0x3002], 0x00, "byte 2 = 0");
  assert.equal(m.ram[0x3003], 0x99, "byte 3 = A (0x99)");
  assert.equal(m.ram[0x74], 0x04, "$74 = 0x00 + 4");
  assert.equal(m.ram[0x75], 0x30, "$75 unchanged (no carry)");
  assert.equal(m.regs.a, 0x04, "A = 4 + $74 = 0x04");
  assert.equal(m.pc, 0x1234, "RTS -> pushed + 1");
  assert.equal(m.cycles, 60, "3+2+2+6+2+6+2+6+2+4+6+2+2+3+3+3(bcc taken)+6 = 60 T");
});

test("loc_b56a: carry advance bumps $75 -- $74=0xff + 4 wraps, inc $75, 64 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.regs.a = 0x7f;
  m.ram[0x74] = 0xff; m.ram[0x75] = 0x30; // ptr = 0x30ff

  loc_b56a(m);

  assert.equal(m.ram[0x30ff], 0x00, "byte 0 = 0");
  assert.equal(m.ram[0x3102], 0x7f, "byte 3 wraps to 0x3102 = A"); // 0x30ff + 3 = 0x3102
  assert.equal(m.ram[0x74], 0x03, "$74 = 0xff + 4 = 0x03 (wrapped)");
  assert.equal(m.ram[0x75], 0x31, "$75 incremented on carry");
  assert.equal(m.cycles, 64, "60 - 3 (bcc taken) + 2 (bcc fall) + 5 (inc zp) = 64 T");
});
