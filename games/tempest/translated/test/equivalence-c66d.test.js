// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c66d (ROM 0xc66d). Minimal 6502 harness (Regs + flat RAM + page-1 stack seam),
// author-derived. Straight-line: 16-bit signed averages of $036a/$035a[x,y] and $038a/$037a[x,y] into
// $61/$62 and $63/$64, then 4 bytes out via ($74),y with $1f mask on the high bytes, mirrored to $6a-$6d.
// Run: node --test games/tempest/translated/test/equivalence-c66d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c66d } from "../loc_c66d.js";

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

test("loc_c66d: slot 5 averaged with slot 6, signed >>1, 4 bytes to ($74)+$a9; 157 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001

  m.ram[0x38] = 0x05; // slot index -> x=5, y=(5+1)&0x0f=6
  // low+high nibbles of the two X/Y coordinate tables at [x=5] and [y=6]
  m.ram[0x036a + 5] = 0x30; m.ram[0x036a + 6] = 0x50; // -> +carry(sec) = 0x81 -> $61
  m.ram[0x035a + 5] = 0x00; m.ram[0x035a + 6] = 0x01; // -> 0x01 -> $62, then asl/ror pair
  m.ram[0x038a + 5] = 0x10; m.ram[0x038a + 6] = 0x20; // -> +carry(sec) = 0x31 -> $63
  m.ram[0x037a + 5] = 0x02; m.ram[0x037a + 6] = 0x03; // -> 0x05 -> $64
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x40; // ($74) -> 0x4000
  m.ram[0xa9] = 0x10; // display write cursor

  loc_c66d(m);

  // signed 16-bit >>1: {$62,$61} = 0x0081 -> 0x0040 ; {$64,$63} = 0x0031 -> 0x0018
  assert.equal(m.mem.read8(0x61), 0xc0, "$61 = ror(0x81) with carry-in from asl a");
  assert.equal(m.mem.read8(0x62), 0x00, "$62 = ror(0x01)");
  assert.equal(m.mem.read8(0x63), 0x98, "$63 = ror(0x31) with carry-in from asl a");
  assert.equal(m.mem.read8(0x64), 0x02, "$64 = ror(0x05)");
  // display list: $63, $64&0x1f, $61, $62&0x1f written at 0x4010..0x4013
  assert.equal(m.mem.read8(0x4010), 0x98, "($74),$a9+0 = $63");
  assert.equal(m.mem.read8(0x4011), 0x02, "($74),+1 = $64 & 0x1f");
  assert.equal(m.mem.read8(0x4012), 0xc0, "($74),+2 = $61");
  assert.equal(m.mem.read8(0x4013), 0x00, "($74),+3 = $62 & 0x1f");
  // mirror cells
  assert.equal(m.mem.read8(0x6c), 0x98, "$6c mirrors $63");
  assert.equal(m.mem.read8(0x6d), 0x02, "$6d mirrors $64");
  assert.equal(m.mem.read8(0x6a), 0xc0, "$6a mirrors $61");
  assert.equal(m.mem.read8(0x6b), 0x00, "$6b mirrors $62");
  assert.equal(m.mem.read8(0xa9), 0x14, "$a9 advanced by 4");
  assert.equal(m.regs.x, 0x05, "X = slot (tax, unchanged)");
  assert.equal(m.regs.y, 0x14, "Y ended at $a9");
  assert.equal(m.pc, 0x2001, "rts -> pushed + 1");
  assert.equal(m.cycles, 157, "straight-line total");
});
