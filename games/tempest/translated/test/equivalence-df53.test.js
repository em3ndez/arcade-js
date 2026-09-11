// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df53 (ROM 0xdf53) -- emit {0x40,0x80} header; loc_df57 shared tail emits {A,X}.
// Run: node --test games/tempest/translated/test/equivalence-df53.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df53, loc_df57 } from "../loc_df53.js";

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

test("loc_df53: emits {0x40,0x80} through ($74), falls into loc_df5f, 22 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);

  loc_df53(m);

  assert.equal(m.mem.read8(0x4000), 0x40, "header byte 0x40 at ($74),0");
  assert.equal(m.mem.read8(0x4001), 0x80, "header byte 0x80 at ($74),1");
  assert.equal(m.regs.a, 0x80, "A holds X's value after txa");
  assert.equal(m.regs.x, 0x80, "X = 0x80");
  assert.deepEqual(m.calls, [0xdf5f], "falls into loc_df5f");
  assert.equal(m.pc, 0xdf5f);
  assert.equal(m.cycles, 22, "2 (lda) + 2 (ldx) + 2 (ldy) + 6 (sta) + 2 (iny) + 2 (txa) + 6 (sta)");
});

test("loc_df57 (mid-entry): emits {A,X} with preset A/X, 18 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0xab;
  m.regs.x = 0xcd;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);

  loc_df57(m);

  assert.equal(m.mem.read8(0x4000), 0xab, "A at ($74),0");
  assert.equal(m.mem.read8(0x4001), 0xcd, "X at ($74),1");
  assert.deepEqual(m.calls, [0xdf5f]);
  assert.equal(m.pc, 0xdf5f);
  assert.equal(m.cycles, 18, "2 (ldy) + 6 (sta) + 2 (iny) + 2 (txa) + 6 (sta)");
});
