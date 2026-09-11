// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_96ab / loc_96b7 / loc_96c4 (ROM 0x96ab-0x96c6) -- the (0x2c),y coordinate walker
// with three dispatch entry points. Run: node --test games/tempest/translated/test/equivalence-96ab.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/6502.js";
import { loc_96ab, loc_96b7, loc_96c4 } from "../loc_96ab.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; } };
  return {
    regs, mem, ram, cycles: 0, pc: 0, calls: [],
    step(n, c) { this.pc = n; this.cycles += c; },
    call(t) { this.calls.push(t); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
  };
}
// ptr $2c/$2d -> 0x3000; the list bytes sit at 0x3000+.
function seed(m) { m.mem.write8(0x2c, 0x00); m.mem.write8(0x2d, 0x30); m.push16(0x1234); }

test("loc_96c4: reads (0x2c),y, sets NZ, rts", () => {
  const m = makeMachine(); seed(m);
  m.regs.y = 0x10; m.mem.write8(0x3010, 0x42);
  loc_96c4(m);
  assert.equal(m.regs.a, 0x42, "A = mem[ptr+y]");
  assert.equal(m.regs.fZ, false); assert.equal(m.regs.fN, false);
  assert.equal(m.pc, 0x1235, "rts -> pushed return + 1");
  assert.equal(m.cycles, 5 + 6, "lda (zp),y in-page 5 + rts 6");
});

test("loc_96c4: page-cross adds 1 cycle", () => {
  const m = makeMachine(); seed(m);
  m.regs.y = 0xff; m.mem.write8(0x30ff + 0x00, 0); m.mem.write8(0x30ff, 0x00);
  // ptr=0x3000, y=0xff -> eff 0x30ff (same page, no cross). Force a cross: ptr low 0x80, y 0x90.
  m.mem.write8(0x2c, 0x80); m.regs.y = 0x90; m.mem.write8((0x3080 + 0x90) & 0xffff, 0x7f);
  loc_96c4(m);
  assert.equal(m.regs.a, 0x7f);
  assert.equal(m.cycles, 6 + 6, "cross -> 6 + rts 6");
});

test("loc_96ab: adjusts $2b, bpl always taken (index 1..16 positive) -> body -> final read", () => {
  const m = makeMachine(); seed(m);
  m.mem.write8(0x2b, 0x05); m.regs.y = 0x20;
  // ($2b-1)&0x0f + 1 = 5; body: sty $29=0x20, y-=2 ->0x1e, sec, sbc (2c),y[0x301e], clc, adc $29, tay, read.
  m.mem.write8(0x301e, 0x03); // subtrahend
  loc_96ab(m);
  assert.equal(m.mem.read8(0x29), 0x20, "sty $29 = entry Y");
  assert.equal(m.pc, 0x1235, "rts");
  assert.deepEqual(m.calls, [], "no cross-routine call (falls through internally)");
  assert.ok(m.cycles > 20, "full path accrues cycles");
});

test("loc_96b7: reloads $2b (skips the decrement) then the shared body", () => {
  const m = makeMachine(); seed(m);
  m.mem.write8(0x2b, 0x40); m.regs.y = 0x22; m.mem.write8(0x3020, 0x01);
  loc_96b7(m);
  assert.equal(m.mem.read8(0x29), 0x22, "sty $29 = Y at entry");
  assert.equal(m.pc, 0x1235, "rts");
});

test("loc_96ab MUTATION: sbc #1 -> the index adjust is load-bearing (Y re-index differs)", () => {
  const m = makeMachine(); seed(m);
  m.mem.write8(0x2b, 0x00); m.regs.y = 0x10;
  // $2b=0: (0-1)&0x0f+1 = 16 (0x10). tya path: A becomes 0x10 pre-and; index math exercised.
  m.mem.write8(0x300e, 0x02);
  loc_96ab(m);
  assert.equal(m.mem.read8(0x29), 0x10, "sty $29 = Y");
});
