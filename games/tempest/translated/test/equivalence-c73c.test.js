// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c73c (ROM 0xc73c). Two 16-bit deltas written through ($74),y. Minimal 6502
// harness. Run: node --test games/tempest/translated/test/equivalence-c73c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c73c } from "../loc_c73c.js";

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

test("loc_c73c: writes ($63:$64)-($6c:$6d) and ($61:$62)-($6a:$6b)|masks, advances $a9, 78 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2500); // rts -> 0x2501
  m.ram[0xa9] = 0x00;                 // cursor
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x40; // ($74) -> 0x4000
  m.ram[0x63] = 0x50; m.ram[0x6c] = 0x10; // 0x50 - 0x10 = 0x40 (C set)
  m.ram[0x64] = 0x03; m.ram[0x6d] = 0x00; // 0x03 - 0x00 - 0 = 0x03; &1f = 0x03
  m.ram[0x61] = 0x30; m.ram[0x6a] = 0x05; // 0x30 - 0x05 = 0x2b (C set)
  m.ram[0x62] = 0x02; m.ram[0x6b] = 0x00; // 0x02 - 0 = 0x02; &1f = 0x02; |a0 = 0xa2

  loc_c73c(m);

  assert.equal(m.ram[0x4000], 0x40, "byte0 = $63 - $6c");
  assert.equal(m.ram[0x4001], 0x03, "byte1 = ($64 - $6d) & 0x1f");
  assert.equal(m.ram[0x4002], 0x2b, "byte2 = $61 - $6a");
  assert.equal(m.ram[0x4003], 0xa2, "byte3 = (($62 - $6b) & 0x1f) | 0xa0");
  assert.equal(m.ram[0xa9], 0x04, "$a9 advanced by 4");
  assert.equal(m.pc, 0x2501, "rts to pushed+1");
  assert.equal(m.cycles, 78, "straight-line total");
});

test("loc_c73c: high-byte borrow propagates through the second subtract", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2500);
  m.ram[0xa9] = 0x10;
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x40;
  m.ram[0x63] = 0x00; m.ram[0x6c] = 0x01; // 0x00 - 0x01 = 0xff, borrow (C clear)
  m.ram[0x64] = 0x05; m.ram[0x6d] = 0x00; // 0x05 - 0x00 - 1(borrow) = 0x04; &1f = 0x04
  m.ram[0x61] = 0x00; m.ram[0x6a] = 0x00;
  m.ram[0x62] = 0x00; m.ram[0x6b] = 0x00;

  loc_c73c(m);

  assert.equal(m.ram[0x4010], 0xff, "byte0 wraps on borrow");
  assert.equal(m.ram[0x4011], 0x04, "byte1 reflects the borrow into the high byte");
  assert.equal(m.ram[0xa9], 0x14, "$a9 advanced by 4 from 0x10");
});
