// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df39 (ROM 0xdf39) -- emit a word {hi=(A>>1)&0x0f|0xa0, lo=X ror}, then bne loc_df5f.
// Run: node --test games/tempest/translated/test/equivalence-df39.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df39 } from "../loc_df39.js";

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

test("loc_df39: carry-in 0 -> hi 0xa2, lo = X ror(C=0), bne taken $df5f, 31 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x24;   // lsr -> 0x12 (C=0), and 0x0f=0x02, ora 0xa0 = 0xa2
  m.regs.x = 0x81;   // txa; ror(C=0) -> 0x40 (C=bit0=1)
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);

  loc_df39(m);

  assert.equal(m.mem.read8(0x4001), 0xa2, "hi byte at ($74),1");
  assert.equal(m.mem.read8(0x4000), 0x40, "lo byte (X ror, C-in 0) at ($74),0");
  assert.deepEqual(m.calls, [0xdf5f], "Y=1 -> bne taken -> loc_df5f");
  assert.equal(m.pc, 0xdf5f);
  assert.equal(m.cycles, 31, "2+2+2+2+6 (hi) + 2+2+2+6 (lo) + 2 (iny) + 3 (bne taken)");
});

test("loc_df39: carry-in 1 -> lo = X ror with bit7 set", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x25;   // lsr -> 0x12 (C=1), and 0x0f=0x02, ora 0xa0 = 0xa2
  m.regs.x = 0x02;   // txa; ror(C=1) -> 0x81 (C=bit0=0)
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);

  loc_df39(m);

  assert.equal(m.mem.read8(0x4001), 0xa2);
  assert.equal(m.mem.read8(0x4000), 0x81, "ror pulls carry into bit7");
  assert.deepEqual(m.calls, [0xdf5f]);
  assert.equal(m.pc, 0xdf5f);
});
