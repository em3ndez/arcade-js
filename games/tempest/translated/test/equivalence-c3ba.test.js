// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c3ba (ROM 0xc3ba-0xc3ed) -- two 16-bit subtracts $6e/$6f=$61/$62-$6a/$6b and
// $70/$71=$63/$64-$6c/$6d, jsr $df92 (X=$6e), copy $61-$64 -> $6a-$6d, $73=0xc0; rts. Opaque-call harness.
// Run: node --test games/tempest/translated/test/equivalence-c3ba.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c3ba } from "../loc_c3ba.js";

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

test("loc_c3ba: 0x0030-0x0010 & 0x0050-0x0020, copy-back, $73=0xc0; 83 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6000); // rts -> 0x6001
  m.ram[0x61] = 0x30; m.ram[0x62] = 0x00; m.ram[0x63] = 0x50; m.ram[0x64] = 0x00;
  m.ram[0x6a] = 0x10; m.ram[0x6b] = 0x00; m.ram[0x6c] = 0x20; m.ram[0x6d] = 0x00;
  loc_c3ba(m);
  assert.equal(m.ram[0x6e], 0x20, "$6e = 0x30 - 0x10 (low)");
  assert.equal(m.ram[0x6f], 0x00, "$6f = 0x00 - 0x00 - borrow(0)");
  assert.equal(m.ram[0x70], 0x30, "$70 = 0x50 - 0x20 (low)");
  assert.equal(m.ram[0x71], 0x00, "$71 high = 0");
  assert.equal(m.ram[0x6a], 0x30, "copy-back $61 -> $6a");
  assert.equal(m.ram[0x6c], 0x50, "copy-back $63 -> $6c");
  assert.equal(m.ram[0x73], 0xc0, "$73 = 0xc0");
  assert.equal(m.regs.x, 0x6e, "X = 0x6e for the df92 call");
  assert.equal(m.regs.a, 0xc0, "A left = 0xc0");
  assert.deepEqual(m.calls, [0xdf92], "single jsr $df92");
  assert.equal(m.pc, 0x6001, "rts -> pushed+1");
  assert.equal(m.cycles, 83, "golden T-state total");
});

test("loc_c3ba: borrow propagates across the low->high subtract (0x0010 - 0x0030)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x6000);
  m.ram[0x61] = 0x10; m.ram[0x62] = 0x00;
  m.ram[0x6a] = 0x30; m.ram[0x6b] = 0x00;
  loc_c3ba(m);
  assert.equal(m.ram[0x6e], 0xe0, "0x10 - 0x30 = 0xe0 (borrow)");
  assert.equal(m.ram[0x6f], 0xff, "high byte gets the borrow: 0x00-0x00-1 = 0xff");
});
