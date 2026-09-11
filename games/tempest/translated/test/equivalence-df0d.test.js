// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df0d (ROM 0xdf0d) -- jsr $df53, A=0x20, then df12 stores A at ($74) and jmp $dfac.
// Run: node --test games/tempest/translated/test/equivalence-df0d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df0d, loc_df12 } from "../loc_df0d.js";

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

test("loc_df0d: jsr $df53, stores 0x20 at ($74), jmp $dfac, 19 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40); // ($74) -> 0x4000

  loc_df0d(m);

  assert.equal(m.mem.read8(0x4000), 0x20, "A=0x20 stored at ($74),0");
  assert.equal(m.regs.a, 0x20, "A holds 0x20");
  assert.equal(m.regs.y, 0x00, "Y=0");
  assert.deepEqual(m.calls, [0xdf53, 0xdfac], "jsr loc_df53 then jmp loc_dfac");
  assert.equal(m.pc, 0xdfac, "PC at jmp target");
  assert.equal(m.cycles, 19, "6 (jsr) + 2 (lda) + 2 (ldy) + 6 (sta) + 3 (jmp)");
});

test("loc_df12 (mid-entry): stores preset A at ($74), jmp $dfac, 11 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0xc0;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);

  loc_df12(m);

  assert.equal(m.mem.read8(0x4000), 0xc0, "preset A=0xc0 stored");
  assert.deepEqual(m.calls, [0xdfac], "jmp loc_dfac");
  assert.equal(m.pc, 0xdfac);
  assert.equal(m.cycles, 11, "2 (ldy) + 6 (sta) + 3 (jmp)");
});
