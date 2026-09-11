// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c6c7 (ROM 0xc6c7). Minimal 6502 harness (Regs + flat RAM + page-1 stack seam
// with jsr/rts balancing via _retPushed, and a recorded calls[] list). Run:
// node --test games/tempest/translated/test/equivalence-c6c7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c6c7 } from "../loc_c6c7.js";

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

test("loc_c6c7: $03ac[$38]==0 -> blank the 4-slot list with {0x00,0x71}, no calls, 127 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000); // outer rts -> 0x3001
  m.ram[0x38] = 0x00;        // x index
  m.ram[0x03ac] = 0x00;      // $03ac,0 == 0 -> bne falls through
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x30; // ($74) -> 0x3000
  m.ram[0xa9] = 0x00;        // write cursor

  loc_c6c7(m);

  for (let i = 0; i < 8; i += 2) {
    assert.equal(m.ram[0x3000 + i], 0x00, `slot ${i} lo == 0x00`);
    assert.equal(m.ram[0x3001 + i], 0x71, `slot ${i} hi == 0x71`);
  }
  assert.equal(m.ram[0xa9], 0x08, "$a9 cursor advanced by 8");
  assert.deepEqual(m.calls, [], "no subroutine calls on the blank path");
  assert.equal(m.pc, 0x3001, "rts to pushed+1");
  assert.equal(m.cycles, 127, "blank-loop path total");
});

test("loc_c6c7: $03ac[$38]!=0 & bit6($039a[$38]) set -> $cec8 word emitted, jsr chain, 116 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x38] = 0x00;
  m.ram[0x03ac] = 0x05;      // != 0 -> bne taken
  m.ram[0x0435] = 0x11;      // -> $56
  m.ram[0x0445] = 0x22;      // -> $58
  m.ram[0x039a] = 0x40;      // bit6 set -> beq NOT taken (dispatch $cec8 word)
  m.ram[0x60ca] = 0x00;      // &2 == 0 -> x = 0x1c
  m.ram[0xcee4] = 0xde;      // $cec8 + 0x1c -> ($74),y (lo, at cursor)
  m.ram[0xcee5] = 0xad;      // $cec9 + 0x1c -> ($74),y+1
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x30; // ($74) -> 0x3000
  // this path uses y (set by the real jsr c73c, stubbed here) as the write cursor, not $a9:
  m.regs.y = 0x05;           // models the cursor c73c would have left in y

  loc_c6c7(m);

  assert.equal(m.ram[0x57], 0x05, "$57 := $03ac,x");
  assert.equal(m.ram[0x56], 0x11, "$56 := $0435,x");
  assert.equal(m.ram[0x58], 0x22, "$58 := $0445,x");
  assert.equal(m.ram[0x3005], 0xde, "cursor+0 := $cec8,x");
  assert.equal(m.ram[0x3006], 0xad, "cursor+1 := $cec9,x");
  assert.equal(m.ram[0xa9], 0x07, "$a9 advanced past the 2-byte word");
  assert.deepEqual(m.calls, [0xc453, 0xc098, 0xc73c, 0xbd3e], "jsr chain recorded in order");
  assert.equal(m.pc, 0x3001, "rts to pushed+1");
  assert.equal(m.cycles, 116, "dispatch-word path total");
});

test("loc_c6c7: $03ac[$38]!=0 & bit6 clear -> $3db2 word path writes 4 bytes", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.ram[0x38] = 0x00;
  m.ram[0x03ac] = 0x09;      // != 0
  m.ram[0x039a] = 0x00;      // bit6 clear -> beq taken (c721 path)
  m.ram[0x3db2] = 0x7e; m.ram[0x3db3] = 0x81;
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x30;
  m.ram[0xa9] = 0x00;

  loc_c6c7(m);

  assert.equal(m.ram[0x3000], 0x00, "byte0 == 0x00");
  assert.equal(m.ram[0x3001], 0x68, "byte1 == 0x68");
  assert.equal(m.ram[0x3002], 0x7e, "byte2 := $3db2");
  assert.equal(m.ram[0x3003], 0x81, "byte3 := $3db3");
  assert.equal(m.ram[0xa9], 0x04, "$a9 advanced by 4");
  assert.deepEqual(m.calls, [0xc453, 0xc098, 0xc73c], "no jsr bd3e on the bit6-clear path");
});
