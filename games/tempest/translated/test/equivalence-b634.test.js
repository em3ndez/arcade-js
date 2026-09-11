// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b634 (ROM 0xb634-0xb686) -- builds screen point ($2e,$30) for slot x from
// $03ce/$03de,y ($56/$58) plus the $b68b/$b687,y2 signed deltas (y2=$02cc,x & 0x0f), each biased-add
// with signed saturation; then $0112 -> $bcdc/$bcec into $59/$5a. Copies $57->$2f. No JSR in this routine.
// Run: node --test games/tempest/translated/test/equivalence-b634.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b634 } from "../loc_b634.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(next, c) { this.pc = next; this.cycles += c; },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("no clamp: both bvc taken, all inputs zero -> $2e/$30 = 0, copies $57->$2f", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x57] = 0x42;             // -> $2f
  // 02b9=0 -> y1=0; 03ce/03de=0 -> $56/$58=0; 02cc=0 -> y2=0; b68b/b687=0 (no overflow); 0112=0
  loc_b634(m);
  assert.deepEqual(m.calls, [], "routine makes no JSR");
  assert.equal(m.ram[0x2f], 0x42, "$57 copied to $2f");
  assert.equal(m.ram[0x2e], 0x00, "first coord: 0x80+0 -> eor 0x80 -> 0x00");
  assert.equal(m.ram[0x30], 0x00, "second coord likewise");
  assert.equal(m.ram[0x59], 0x00);
  assert.equal(m.ram[0x5a], 0x00);
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 94);
});

test("first coord clamp, N clear (two negatives overflow) -> lda #0x80 -> $2e = 0x00", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  // $56 = 0 -> biased 0x80; b68b = 0x80 -> 0x80+0x80 = 0x00, V set, N clear -> bpl taken -> lda #0x80
  m.ram[0xb68b] = 0x80;
  loc_b634(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x2e], 0x00, "0x80 eor 0x80 -> 0x00");
  assert.equal(m.ram[0x30], 0x00, "second coord no clamp");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 98);
});

test("first coord clamp, N set (two positives overflow) -> lda #0x7f -> $2e = 0xff", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x03ce] = 0xff;           // -> $56 = 0xff -> biased 0x7f
  m.ram[0xb68b] = 0x7f;           // 0x7f+0x7f = 0xfe, V set, N set -> bpl not taken -> lda #0x7f
  loc_b634(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x2e], 0xff, "0x7f eor 0x80 -> 0xff");
  assert.equal(m.ram[0x30], 0x00);
  assert.equal(m.cycles, 102);
});

test("second coord clamp, N clear -> lda #0x80 -> $30 = 0x00 (first no clamp)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  // first add clean; second: $58=0 -> 0x80, b687=0x80 -> 0x00, V set, N clear
  m.ram[0xb687] = 0x80;
  loc_b634(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x2e], 0x00, "first coord unclamped");
  assert.equal(m.ram[0x30], 0x00);
  assert.equal(m.cycles, 98);
});

test("second coord clamp, N set -> lda #0x7f -> $30 = 0xff (first no clamp)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x03de] = 0xff;           // -> $58 = 0xff -> biased 0x7f
  m.ram[0xb687] = 0x7f;           // 0xfe, V set, N set
  loc_b634(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x2e], 0x00);
  assert.equal(m.ram[0x30], 0xff);
  assert.equal(m.cycles, 102);
});

test("edge: abs,x and abs,y page crosses add +1 each (no clamp path)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;                // 02b9+0x80=0x0339, 02cc+0x80=0x034c -> both cross page 02->03
  m.ram[0x0339] = 0xff;           // y1 = 0xff -> 03ce/03de +0xff cross page 03->04
  m.ram[0x034c] = 0x00;           // y2 = 0 (no delta-table cross; b68b/b687 stay in page b6)
  m.ram[0x0112] = 0xff;           // y3 = 0xff -> bcdc/bcec +0xff cross page bc->bd
  loc_b634(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x2e], 0x00, "$56=0 biased 0x80 + 0 -> 0x00");
  assert.equal(m.ram[0x30], 0x00);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 100, "94 + 6 crossing loads (02b9,02cc,03ce,03de,bcdc,bcec)");
});
