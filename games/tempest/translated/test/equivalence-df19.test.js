// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df19 (ROM 0xdf19) -- table-driven word emit through ($74),y then jsr loc_df5f, rts.
// Run: node --test games/tempest/translated/test/equivalence-df19.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df19 } from "../loc_df19.js";

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

test("loc_df19: carry clear -> index = (A&0x0f)+1, emit table word, 56 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.regs.fC = false;
  m.regs.a = 0x05;                       // -> and 0x0f=0x05, +1=0x06, asl -> X=0x0c
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40); // ($74) -> 0x4000
  m.mem.write8(0x31f0, 0xaa);            // $31e4 + 0x0c
  m.mem.write8(0x31f1, 0xbb);            // $31e5 + 0x0c

  loc_df19(m);

  assert.equal(m.regs.x, 0x0c, "index doubled = 0x0c");
  assert.equal(m.mem.read8(0x4000), 0xaa, "word lo from $31f0 at ($74),0");
  assert.equal(m.mem.read8(0x4001), 0xbb, "word hi from $31f1 at ($74),1");
  assert.deepEqual(m.calls, [0xdf5f], "jsr loc_df5f");
  assert.equal(m.pc, 0x1234, "rts returns to pushed+1");
  assert.equal(m.cycles, 56, "3+2+2+2 (df1f path) + 3+2+2+2 + 4+6+4+2+6 + 6 (jsr) + 4 (plp) + 6 (rts)");
});

test("loc_df19: carry set, low nibble 0 -> beq skips the +1 (index 0), 54 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.regs.fC = true;
  m.regs.a = 0x10;                       // and 0x0f = 0 -> beq df24, asl -> X=0
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);
  m.mem.write8(0x31e4, 0x11);
  m.mem.write8(0x31e5, 0x22);

  loc_df19(m);

  assert.equal(m.regs.x, 0x00, "index = 0");
  assert.equal(m.mem.read8(0x4000), 0x11);
  assert.equal(m.mem.read8(0x4001), 0x22);
  assert.deepEqual(m.calls, [0xdf5f]);
  assert.equal(m.pc, 0x2001);
  assert.equal(m.cycles, 54, "2 (bcc fall) + 2 (and) + 3 (beq taken) + 3+2+2+2 + 4+6+4+2+6 + 6 + 4 + 6");
});
