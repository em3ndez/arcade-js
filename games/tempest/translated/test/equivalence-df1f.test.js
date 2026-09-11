// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_df1f (ROM 0xdf1f-0xdf38) incl. the loc_df24 mid-entry. Author-derived 6502
// harness; php/plp bracket the body and jsr df5f is recorded (its return push balanced).
// Run: node --test games/tempest/translated/test/equivalence-df1f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_df1f, loc_df24 } from "../loc_df1f.js";

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

test("loc_df1f: A=(A&$0f)+1, index $31e4 word table, emit through ($74),y, plp, rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x5000); // rts -> 0x5001
  m.regs.a = 0x35; // & 0x0f = 5, +1 = 6, asl -> 0x0c
  m.mem.write8(0x0074, 0x00); m.mem.write8(0x0075, 0x60); // ($74) -> 0x6000
  m.mem.write8(0x31f0, 0xab); // $31e4 + 0x0c
  m.mem.write8(0x31f1, 0xcd); // $31e5 + 0x0c

  loc_df1f(m);

  assert.equal(m.mem.read8(0x6000), 0xab, "first table byte through ($74),y");
  assert.equal(m.mem.read8(0x6001), 0xcd, "second table byte through ($74),y+1");
  assert.equal(m.regs.x, 0x0c, "X = ((A&0f)+1)*2");
  assert.deepEqual(m.calls, [0xdf5f], "jsr df5f advances the cursor");
  assert.equal(m.regs.fC, false, "plp restored post-`adc #1` carry (0x05+1 no carry)");
  assert.equal(m.pc, 0x5001, "rts -> pushed + 1");
  assert.equal(m.cycles, 53, "prologue 6 + df24 body 47");
});

test("loc_df24: mid-entry with A preset (A=$08 -> index 0x10)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x6000); // rts -> 0x6001
  m.regs.a = 0x08;
  m.mem.write8(0x0074, 0x80); m.mem.write8(0x0075, 0x40); // ($74) -> 0x4080
  m.mem.write8(0x31f4, 0x11); // $31e4 + 0x10
  m.mem.write8(0x31f5, 0x22); // $31e5 + 0x10

  loc_df24(m);

  assert.equal(m.mem.read8(0x4080), 0x11, "first byte");
  assert.equal(m.mem.read8(0x4081), 0x22, "second byte");
  assert.equal(m.regs.x, 0x10, "X = A*2");
  assert.deepEqual(m.calls, [0xdf5f], "jsr df5f");
  assert.equal(m.pc, 0x6001, "rts -> pushed + 1");
  assert.equal(m.cycles, 47, "php3+asl2+ldy2+tax2+lda4+sta6+lda4+iny2+sta6+jsr6+plp4+rts6");
});
