// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9749 (ROM 0x9749) -- spinner-delta clamp/fold. Minimal 6502 harness.
// Run: node --test .../equivalence-9749.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9749 } from "../loc_9749.js";

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

test("loc_9749: $0201 negative -> early rts, 12 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.mem.write8(0x0201, 0x80); // N set -> bpl not taken -> rts

  loc_9749(m);

  assert.equal(m.regs.a, 0x80, "A = $0201");
  assert.equal(m.pc, 0x1234, "rts -> pushed+1");
  assert.deepEqual(m.calls, [], "no subroutines called");
  assert.equal(m.cycles, 12, "4 (lda abs) + 2 (bpl fall) + 6 (rts)");
});

test("loc_9749: call-free clamp path ($05 neg, $50=0x40) -> stores, 109 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.mem.write8(0x0201, 0x00); // positive -> proceed
  m.mem.write8(0x05, 0x80);   // negative -> bmi taken (uses $50, no jsr 0x97c5)
  m.mem.write8(0x50, 0x40);   // positive & >= 0x1f -> clamped stays 0x40
  m.mem.write8(0x51, 0x00);   // base for adc
  m.mem.write8(0x0111, 0x00); // X=0 -> beq 0x979d (skip the 977e..979b block)
  m.mem.write8(0x0200, 0x0e); // == $2a -> beq 0x97b6 (skip jsr 0xccb5)

  loc_9749(m);

  // 976e stx 0x50 with X=0 (from ldx #0 at 974f)
  assert.equal(m.mem.read8(0x50), 0x00, "$50 := X = 0");
  // $2b at 9770 = A(=0x1f clamp); then recomputed at 97aa: (($2c>>4)+1)&0x0f
  // $2c at 9777 = (0x1f^0xff)+$51+carry(sec) = 0xe0+0+1 = 0xe1
  assert.equal(m.mem.read8(0x2c), 0xe1, "$2c = 0xe1 (never overwritten on beq-taken path)");
  assert.equal(m.mem.read8(0x2a), 0x0e, "$2a = 0xe1 >> 4 = 0x0e");
  assert.equal(m.mem.read8(0x2b), 0x0f, "$2b = (0x0e + 1) & 0x0f = 0x0f");
  assert.equal(m.mem.read8(0x0200), 0x0e, "$0200 := $2a");
  assert.equal(m.mem.read8(0x0201), 0x0f, "$0201 := $2b");
  assert.equal(m.mem.read8(0x51), 0xe1, "$51 := $2c");
  assert.equal(m.regs.a, 0xe1, "A = $2c on the way out");
  assert.deepEqual(m.calls, [], "beq's skip both jsr sites");
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.equal(m.cycles, 109, "traced instruction T-states for this path");
});
