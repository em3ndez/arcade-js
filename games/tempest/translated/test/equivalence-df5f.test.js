// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df5f (ROM 0xdf5f) -- advance ($74/$75) cursor by Y+1, carry into $75, rts.
// Run: node --test games/tempest/translated/test/equivalence-df5f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df5f } from "../loc_df5f.js";

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

test("loc_df5f: Y+$74 with no page carry, bcc taken -> rts, 19 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.regs.y = 0x02;
  m.mem.write8(0x74, 0x10); m.mem.write8(0x75, 0x40);

  loc_df5f(m);

  assert.equal(m.mem.read8(0x74), 0x13, "$74 = 0x10 + Y + 1(sec) = 0x13");
  assert.equal(m.mem.read8(0x75), 0x40, "$75 unchanged (no carry)");
  assert.equal(m.pc, 0x1234, "rts to pushed+1");
  assert.equal(m.cycles, 19, "2 (tya) + 2 (sec) + 3 (adc) + 3 (sta) + 3 (bcc taken) + 6 (rts)");
});

test("loc_df5f: page carry increments $75, 23 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.regs.y = 0x02;
  m.mem.write8(0x74, 0xfe); m.mem.write8(0x75, 0x40);

  loc_df5f(m);

  assert.equal(m.mem.read8(0x74), 0x01, "0xfe + 2 + 1 = 0x101 -> 0x01");
  assert.equal(m.mem.read8(0x75), 0x41, "carry -> $75 incremented");
  assert.equal(m.pc, 0x2001);
  assert.equal(m.cycles, 23, "2 + 2 + 3 + 3 + 2 (bcc fall) + 5 (inc) + 6 (rts)");
});
