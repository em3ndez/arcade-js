// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df92 (ROM 0xdf92) -- emit a 4-byte vector record from ($00..$03,x); loc_dfac
// stores the last byte and bne loc_df5f (else falls into loc_dfb1).
// Run: node --test games/tempest/translated/test/equivalence-df92.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df92, loc_dfac } from "../loc_df92.js";

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

test("loc_df92: emits {x, y&0x1f, x, masked-eor} through ($74), bne taken $df5f, 61 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.x = 0x10;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);
  m.mem.write8(0x12, 0x55); // $02,x
  m.mem.write8(0x13, 0xa3); // $03,x -> &0x1f = 0x03
  m.mem.write8(0x10, 0x77); // $00,x
  m.mem.write8(0x11, 0x99); // $01,x
  m.mem.write8(0x73, 0x04); // eor key: (0x99^0x04)&0x1f ^ 0x04 = 0x19

  loc_df92(m);

  assert.equal(m.mem.read8(0x4000), 0x55, "byte 0 = $02,x");
  assert.equal(m.mem.read8(0x4001), 0x03, "byte 1 = $03,x & 0x1f");
  assert.equal(m.mem.read8(0x4002), 0x77, "byte 2 = $00,x");
  assert.equal(m.mem.read8(0x4003), 0x19, "byte 3 = ((($01,x ^ $73) & 0x1f) ^ $73)");
  assert.deepEqual(m.calls, [0xdf5f], "nonzero last byte -> bne taken -> loc_df5f");
  assert.equal(m.pc, 0xdf5f);
  assert.equal(m.cycles, 61, "2+4+6+4+2+2+6+4+2+6+4+3+2+3 (df92) + 2+6+3 (dfac)");
});

test("loc_dfac (mid-entry): iny wraps 0xff->0 (Z set) -> bne falls into loc_dfb1, 10 T; branch tests Y not A", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x1f; // nonzero A: proves bne@dfaf tests the iny@dfac Z flag, not the stored byte (sta sets no flags)
  m.regs.y = 0xff; // iny wraps 0xff -> 0x00 -> Z set -> bne not taken
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);

  loc_dfac(m);

  assert.equal(m.regs.y, 0x00, "Y wrapped 0xff -> 0x00");
  assert.equal(m.mem.read8(0x4000), 0x1f, "A stored at ($74),0 after Y wrap");
  assert.deepEqual(m.calls, [0xdfb1], "iny result 0 (Z set) -> bne fall -> loc_dfb1");
  assert.equal(m.pc, 0xdfb1);
  assert.equal(m.cycles, 10, "2 (iny) + 6 (sta) + 2 (bne fall)");
});

test("loc_dfac (mid-entry): nonzero -> bne taken to loc_df5f, 11 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.a = 0x1f;
  m.regs.y = 0x02;
  m.mem.write8(0x74, 0x00); m.mem.write8(0x75, 0x40);

  loc_dfac(m);

  assert.equal(m.mem.read8(0x4003), 0x1f);
  assert.deepEqual(m.calls, [0xdf5f]);
  assert.equal(m.pc, 0xdf5f);
  assert.equal(m.cycles, 11, "2 (iny) + 6 (sta) + 3 (bne taken)");
});
