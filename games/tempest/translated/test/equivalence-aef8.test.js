// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aef8 (ROM 0xaef8-0xaf25) -- copies 3 two-byte glyph words from $31fa+ (index
// = 2*min(cell,0x1a)) into the ($74) buffer, then dey and tail-jmps to $df5f. $39 fixes the loop at 3
// iterations. Author-derived 6502 harness. Run: node --test games/tempest/translated/test/equivalence-aef8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aef8 } from "../loc_aef8.js";

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

test("loc_aef8: 3 uncapped cells -> 6 bytes copied to ($74), y ends 5, tail $df5f; 177 T", () => {
  const m = makeMachine();
  m.regs.a = 0x00;            // slot count -> $38 = A + 2 = 0x02
  m.ram[0x0074] = 0x00;       // ($74) buffer pointer = 0x0400
  m.ram[0x0075] = 0x04;
  m.ram[0x0606] = 0x00;       // iter3 cell (x=$38 counts down 2,1,0)
  m.ram[0x0607] = 0x01;       // iter2 cell
  m.ram[0x0608] = 0x02;       // iter1 cell
  // glyph table $31fa+ (index = 2*cell): cell0->$31fa/fb, cell1->$31fc/fd, cell2->$31fe/ff
  m.ram[0x31fa] = 0xaa; m.ram[0x31fb] = 0xbb;
  m.ram[0x31fc] = 0xcc; m.ram[0x31fd] = 0xdd;
  m.ram[0x31fe] = 0xee; m.ram[0x31ff] = 0xff;

  loc_aef8(m);

  // iter1 (cell 0x02 -> words $31fe/ff) at y=0,1; iter2 (cell 0x01) y=2,3; iter3 (cell 0x00) y=4,5
  assert.equal(m.ram[0x0400], 0xee, "iter1 low byte");
  assert.equal(m.ram[0x0401], 0xff, "iter1 high byte");
  assert.equal(m.ram[0x0402], 0xcc, "iter2 low byte");
  assert.equal(m.ram[0x0403], 0xdd, "iter2 high byte");
  assert.equal(m.ram[0x0404], 0xaa, "iter3 low byte");
  assert.equal(m.ram[0x0405], 0xbb, "iter3 high byte");
  assert.equal(m.ram[0x38], 0xff, "$38 decremented 3x from 2 -> 0xff");
  assert.equal(m.ram[0x39], 0xff, "$39 the loop counter ends at 0xff (2 -> 1 -> 0 -> -1)");
  assert.equal(m.regs.y, 0x05, "y reached 6 then dey -> 5");
  assert.equal(m.pc, 0xdf5f, "tail jmp $df5f");
  assert.deepEqual(m.calls, [0xdf5f], "one tail-call to $df5f");
  // prologue 14 + iter(50)*3 + bpl(3+3+2) + dey(2) + jmp(3)
  assert.equal(m.cycles, 14 + (50 + 3) + (50 + 3) + (50 + 2) + 2 + 3, "177 T");
});

test("loc_aef8: cell >= 0x1e is capped to 0x1a (BCC not taken -> lda #$1a)", () => {
  const m = makeMachine();
  m.regs.a = 0x00;            // $38 = 0x02
  m.ram[0x0074] = 0x00;
  m.ram[0x0075] = 0x04;
  m.ram[0x0608] = 0x20;       // iter1 cell >= 0x1e -> capped to 0x1a, index 2*0x1a = 0x34
  m.ram[0x0607] = 0x01;
  m.ram[0x0606] = 0x00;
  m.ram[0x322e] = 0x11; m.ram[0x322f] = 0x22; // $31fa + 0x34 = $322e (capped glyph)
  m.ram[0x31fc] = 0xcc; m.ram[0x31fd] = 0xdd;
  m.ram[0x31fa] = 0xaa; m.ram[0x31fb] = 0xbb;

  loc_aef8(m);

  assert.equal(m.ram[0x0400], 0x11, "capped iter1 low byte from $322e");
  assert.equal(m.ram[0x0401], 0x22, "capped iter1 high byte from $322f");
  assert.equal(m.ram[0x0402], 0xcc, "iter2 uncapped");
  assert.equal(m.ram[0x0404], 0xaa, "iter3 uncapped");
  assert.equal(m.pc, 0xdf5f);
  assert.deepEqual(m.calls, [0xdf5f]);
  // iter1: bcc not-taken path + two page-crossing $322e/$322f reads (base $31fa lo 0xfa + 0x34 crosses)
  const iter1 = 3 + 4 + 2 + 2 + 2 + 2 + 2 + 5 + 6 + 2 + 5 + 6 + 2 + 5 + 5 + 3; // 56, bpl taken
  assert.equal(m.cycles, 14 + iter1 + (50 + 3) + (50 + 2) + 2 + 3, "180 T");
});
