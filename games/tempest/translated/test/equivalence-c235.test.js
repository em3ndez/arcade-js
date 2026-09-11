// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c235 (ROM 0xc235-0xc2e7) -- level-geometry setup. Covers the copy path
// ($02==0x1e) and the difference/shift path ($02!=0x1e, the 4-step arithmetic SR into $0121), plus
// the two 16-entry array-fill loops. Minimal 6502 harness with the recorded-call seam. abs,x/abs,y
// table reads charged at the mode base (4T); real hw adds +1 on page crossings -- see needs_attention.
// Run: node --test games/tempest/translated/test/equivalence-c235.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c235 } from "../loc_c235.js";

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

// Common prologue setup: $3d=0 so x=0; $46=0x0f so the loc_c2e8 seam leaves A=0x0f (harness stub) ->
// pha/pla makes Y0=0x0f for the fill loops. $0112=0 -> the bc8c/9c/cc reads index 0.
function seedCommon(m) {
  m.ram[0x3d] = 0x00;
  m.ram[0x46] = 0x0f;
  m.ram[0x0112] = 0x00;
  m.ram[0xbc8c] = 0x30; // eor ff = 0xcf, +1 = 0xd0 -> $5f/$5d
  m.ram[0xbc9c] = 0x11; // -> $60
  m.ram[0xbccc] = 0x22; // -> $0111
}

test("loc_c235: copy path ($02==0x1e) -- $bcac/$bcbc -> $68/$69, common cells, 1653 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // final RTS -> 0x1234
  seedCommon(m);
  m.ram[0x02] = 0x1e;   // == 0x1e -> BNE not taken -> copy path
  m.ram[0xbcac] = 0x33; // -> $68
  m.ram[0xbcbc] = 0x44; // -> $69

  loc_c235(m);

  assert.equal(m.ram[0x5f], 0xd0, "$5f = -(bc8c) = 0xd0");
  assert.equal(m.ram[0x5d], 0xd0, "$5d = 0xd0");
  assert.equal(m.ram[0xa0], 0x40, "$a0 = 0x10 - 0xd0 = 0x40 (mod 256)");
  assert.equal(m.ram[0x5b], 0xff, "$5b = 0xff");
  assert.equal(m.ram[0x60], 0x11, "$60 = $bc9c");
  assert.equal(m.ram[0x0111], 0x22, "$0111 = $bccc");
  assert.equal(m.ram[0x68], 0x33, "$68 = $bcac (copy path)");
  assert.equal(m.ram[0x69], 0x44, "$69 = $bcbc (copy path)");
  assert.equal(m.ram[0x66], 0x00, "$66 cleared");
  assert.equal(m.ram[0x67], 0x00, "$67 cleared");
  assert.equal(m.ram[0x010f], 0x00, "$010f cleared");
  assert.equal(m.ram[0x0110], 0x00, "$0110 cleared");
  assert.equal(m.ram[0x0113], 0x2c, "$0113 = 0x2c");
  assert.equal(m.ram[0x0121], 0x00, "$0121 not written on the copy path");
  assert.deepEqual(m.calls, [0xc2e8], "calls loc_c2e8 once");
  assert.equal(m.pc, 0x1234, "final RTS -> pushed + 1");
  assert.equal(m.cycles, 1653, "prologue 71 + copy path 21 + epilogue 32 + loop1 815 + 4 + loop2 704 + rts 6");
});

test("loc_c235: diff path ($02!=0x1e) -- 4-step SR into $0121, fill loops, 1709 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  seedCommon(m);
  m.ram[0x02] = 0x00;   // != 0x1e -> BNE taken -> difference path
  m.ram[0xbcac] = 0x50; // A=0x50; sec; sbc $68(0x10) = 0x40 -> $0121
  m.ram[0x68] = 0x10;
  m.ram[0xbcbc] = 0x00; // A=0x00; sbc $0069(0x00) with C=1 -> 0x00
  m.ram[0x69] = 0x00;
  // fill-loop source tables (Y0=0x0f down to 0): uniform 0x40 -> $03ce/$03de/$03ee all 0x40
  for (let i = 0; i <= 0x0f; i++) { m.ram[0xb97c + i] = 0x40; m.ram[0xba7c + i] = 0x40; m.ram[0xbb7c + i] = 0x40; }

  loc_c235(m);

  // 16-bit value {A=0x00 : $0121=0x40} shifted right 4 = 0x0004
  assert.equal(m.ram[0x0121], 0x04, "$0121 = 0x0040 >> 4 = 0x04");
  // loop1: 1:1 copy (X=Y=0x0f..0) of the uniform 0x40 tables
  assert.equal(m.ram[0x03ce], 0x40, "$03ce[0] = $b97c table");
  assert.equal(m.ram[0x03de], 0x40, "$03de[0] = $ba7c table");
  assert.equal(m.ram[0x03ee], 0x40, "$03ee[0] = $bb7c table");
  assert.equal(m.ram[0x031a], 0x00, "$031a[0] cleared");
  assert.equal(m.ram[0x033a], 0x00, "$033a[0] cleared");
  assert.equal(m.ram[0x039a], 0x00, "$039a[0] cleared");
  // loop2: ror((0x40 + 0x40 + 1))=0x40 across the uniform arrays
  assert.equal(m.ram[0x0435], 0x40, "$0435[0] = ror(0x40+0x40+1)");
  assert.equal(m.ram[0x0445], 0x40, "$0445[0] = ror(0x40+0x40+1)");
  assert.equal(m.ram[0x0435 + 0x0f], 0x40, "$0435[0x0f]");
  assert.equal(m.ram[0x68], 0x10, "$68 untouched on the diff path (only read)");
  assert.equal(m.ram[0x0113], 0x2c, "$0113 = 0x2c");
  assert.equal(m.regs.x, 0xff, "x ran 0x0f -> -1 out of loop2");
  assert.deepEqual(m.calls, [0xc2e8], "calls loc_c2e8 once");
  assert.equal(m.pc, 0x1001, "final RTS -> pushed + 1");
  assert.equal(m.cycles, 1709, "prologue 71 + diff path 77 + epilogue 32 + loop1 815 + 4 + loop2 704 + rts 6");
});
