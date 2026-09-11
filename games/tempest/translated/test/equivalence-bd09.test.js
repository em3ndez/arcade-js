// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_bd09 (ROM 0xbd09-0xbd3d). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration check.
// The three JSRs (c098/c765/bd3e) are opaque here (harness records the call, does not run it), so $78 and
// the ($74) pointer are seeded directly. Run: node --test games/tempest/translated/test/equivalence-bd09.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_bd09 } from "../loc_bd09.js";

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

test("loc_bd09: BCS taken ($78 nibble >= 0x0a), 2-byte entry + table reload, tail to 0xdf59; 83 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.y = 0x00;
  m.ram[0x0078] = 0x00; // eor 0x07 -> 0x07; asl -> 0x0e; cmp #0x0a -> C set -> BCS taken
  m.ram[0x0074] = 0x00; m.ram[0x0075] = 0x62; // ($74) -> 0x6200
  m.ram[0x0055] = 0x03; // ldy 0x55
  m.ram[0xcecc] = 0x44; // ldx 0xcec9,y  (0xcec9 + 3)
  m.ram[0xcecb] = 0x99; // lda 0xcec8,y  (0xcec8 + 3)

  loc_bd09(m);

  assert.equal(m.ram[0x6200], 0xe0, "0x0e << 4 = 0xe0 written at ($74),0");
  assert.equal(m.ram[0x6201], 0x60, "0x60 written at ($74),1");
  assert.equal(m.ram[0x00a9], 0x02, "$a9 = y after the two iny (0->2)");
  assert.equal(m.regs.x, 0x44, "x reloaded from $cecc");
  assert.equal(m.regs.a, 0x99, "a reloaded from $cecb");
  assert.equal(m.regs.y, 0x02, "y reloaded from $a9");
  assert.equal(m.pc, 0xdf59, "JMP tail to 0xdf59");
  assert.deepEqual(m.calls, [0xc098, 0xc765, 0xbd3e, 0xdf59], "jsr c098, c765, bd3e then jmp df59");
  assert.equal(m.cycles, 83, "golden T-state total (BCS taken, no page cross)");
});

test("loc_bd09: BCS not taken ($78 nibble < 0x0a) -> lda #0x0a; 84 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.regs.y = 0x00;
  m.ram[0x0078] = 0x03; // eor 0x07 -> 0x04; asl -> 0x08; cmp #0x0a -> C clear -> BCS not taken -> lda #0x0a
  m.ram[0x0074] = 0x00; m.ram[0x0075] = 0x62;
  m.ram[0x0055] = 0x00;
  m.ram[0xcec9] = 0x11; // ldx 0xcec9,0
  m.ram[0xcec8] = 0x22; // lda 0xcec8,0

  loc_bd09(m);

  assert.equal(m.ram[0x6200], 0xa0, "0x0a << 4 = 0xa0 written at ($74),0");
  assert.equal(m.ram[0x6201], 0x60, "0x60 at ($74),1");
  assert.equal(m.regs.x, 0x11, "x from $cec9");
  assert.equal(m.regs.a, 0x22, "a from $cec8");
  assert.equal(m.pc, 0xdf59, "tail to 0xdf59");
  assert.equal(m.cycles, 84, "one more T than taken (2+2 vs 3 at the BCS)");
});
