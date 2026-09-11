// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c16e (ROM 0xc16e-0xc1c2) -- calls loc_aa13 + loc_c235, conditional $5800
// write, $2000/$2001 hardware copy, then the 8-entry $c1fd-table nibble unpack into the $0019/$0021 +
// $0800/$0808 arrays (indexed by a clamped $9f). Minimal 6502 harness. The abs,x table reads (lda $c1fd,x
// at 0xc1a6 and 0xc1b4) charge 4T + 1 whenever $c1fd+x crosses the $c1fd->$c200 page boundary, i.e. x>=3.
// Run: node --test games/tempest/translated/test/equivalence-c16e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c16e } from "../loc_c16e.js";

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

test("loc_c16e: $9f=0 (x=7), $0133=0 -> writes $5800, unpacks the 8 table entries; 448 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // final RTS -> 0x1234
  m.ram[0x0133] = 0x00; // BNE not taken -> the $5800 write runs
  m.ram[0x9f] = 0x00;   // & 0x70 = 0 < 0x5f -> BCC taken, A stays 0 -> x = (0 lsr) | 7 = 7
  // table $c1fd,x for x = 7..0 -> 0xc204..0xc1fd
  const tbl = [0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70, 0x81]; // indices 0..7 (== x)
  for (let i = 0; i <= 7; i++) m.ram[0xc1fd + i] = tbl[i];

  loc_c16e(m);

  assert.equal(m.ram[0x5e], 0x80, "$5e = 0x80");
  assert.equal(m.ram[0x0114], 0xff, "$0114 = 0xff");
  assert.equal(m.ram[0x5800], 0x00, "$5800 = A written on the BNE-not-taken path; A = mem[0x0133] = 0x00 (lda 0x0133 at c17d reloaded A, overwriting the earlier lda #0xff/sta 0x0114)");
  assert.equal(m.ram[0x0133], 0x00, "$0133 cleared");
  // $2000/$2001 copied from $cec6/$cec7 (both 0 in a blank image)
  assert.equal(m.ram[0x2000], 0x00, "$2000 = $cec6");
  assert.equal(m.ram[0x2001], 0x00, "$2001 = $cec7");
  // unpack: for i(=x=y) in 0..7 -> low nibble to $0019+i/$0800+i, high nibble to $0021+i/$0808+i
  for (let i = 0; i <= 7; i++) {
    const v = tbl[i];
    assert.equal(m.ram[0x0019 + i], v & 0x0f, `$${(0x0019 + i).toString(16)} low nibble`);
    assert.equal(m.ram[0x0800 + i], v & 0x0f, `$${(0x0800 + i).toString(16)} low nibble`);
    assert.equal(m.ram[0x0021 + i], (v >> 4) & 0x0f, `$${(0x0021 + i).toString(16)} high nibble`);
    assert.equal(m.ram[0x0808 + i], (v >> 4) & 0x0f, `$${(0x0808 + i).toString(16)} high nibble`);
  }
  assert.equal(m.regs.x, 0xff, "x ran 7 -> -1");
  assert.equal(m.regs.y, 0xff, "y ran 7 -> -1");
  assert.deepEqual(m.calls, [0xaa13, 0xc235], "calls loc_aa13 then loc_c235");
  assert.equal(m.pc, 0x1234, "final RTS -> pushed + 1");
  assert.equal(m.cycles, 448, "73 pre-loop + 359 flat loop + 6 rts + 10 page-cross (x>=3: x=7..3, 5 iters x 2 lda $c1fd,x reads)");
});

test("loc_c16e: $0133!=0 -> BNE taken (no $5800 write); $9f=0x70 clamps A to 0x5f (x=0x2f); 452 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x0133] = 0x05; // BNE taken -> skip the $5800 write
  m.ram[0x5800] = 0x77; // must stay untouched
  m.ram[0x9f] = 0x70;   // & 0x70 = 0x70 >= 0x5f -> BCC not taken -> A = 0x5f -> lsr 0x2f | 7 = 0x2f
  // x = 0x2f..0x28 reads $c1fd+x = 0xc22c..0xc225
  for (let i = 0; i <= 7; i++) m.ram[0xc1fd + 0x28 + i] = 0x90 + i;

  loc_c16e(m);

  assert.equal(m.ram[0x5800], 0x77, "$5800 untouched on the BNE-taken path");
  assert.equal(m.ram[0x0133], 0x00, "$0133 still cleared");
  // y=7..0 pairs with x=0x2f..0x28; table cell for y is $c1fd+(0x28+y)
  for (let y = 0; y <= 7; y++) {
    const v = 0x90 + (0x28 + y - 0x28); // == 0x90 + y ; cell at 0xc1fd+0x28+y
    assert.equal(m.ram[0x0019 + y], v & 0x0f, `$${(0x0019 + y).toString(16)} low nibble`);
    assert.equal(m.ram[0x0021 + y], (v >> 4) & 0x0f, `$${(0x0021 + y).toString(16)} high nibble`);
  }
  assert.equal(m.regs.x, 0x27, "x ran 0x2f -> 0x27");
  assert.equal(m.pc, 0x1001, "final RTS -> pushed + 1");
  assert.equal(m.cycles, 452, "438 flat - 4 (skip $5800) + 1 (BNE taken) - 1 (BCC not taken) + 2 (lda #$5f) = 436 flat; + 16 page-cross (all 8 iters cross, x=0x2f..0x28 all >=3, x 2 lda $c1fd,x reads)");
});
