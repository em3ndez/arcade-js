// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b131 (ROM 0xb131-0xb159) -- jsr $b15a, then clamp $014d (dec while >= $30,
// early rts if result >= $80) and $014e (dec toward but not below $014d). rts.
// Run: node --test games/tempest/translated/test/equivalence-b131.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b131 } from "../loc_b131.js";

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

// bcc taken ($014d < $30 -> no decrement) + bcs $b146 not taken + bcs $b151 taken ($014e-1 kept)
test("loc_b131: $014d < $30 (bcc taken), $014e stepped down and kept", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x014d] = 0x20;            // < $30 -> bcc taken, $014d untouched
  m.ram[0x014e] = 0x50;            // 0x50-1 = 0x4f >= 0x20 -> bcs $b151 taken -> keep
  loc_b131(m);
  assert.deepEqual(m.calls, [0xb15a], "one jsr $b15a");
  assert.deepEqual(m.retAddrs, [0xb137], "jsr pushes 0xb135+2");
  assert.equal(m.ram[0x014d], 0x20, "$014d unchanged (< $30)");
  assert.equal(m.ram[0x014e], 0x4f, "$014e := $014e - 1 (>= $014d)");
  assert.equal(m.regs.a, 0x4f, "A holds $014e-1");
  assert.equal(m.regs.x, 0x4e, "X = $4e");
  assert.equal(m.pc, 0x5001, "rts -> sentinel + 1");
  assert.equal(m.cycles, 48, "16 + bcc3 + cmp2 + bcs2 + 12 + bcs3 + sta4 + rts6");
});

// bcc not taken ($014d >= $30 -> decrement) + bcs $b146 not taken + bcs $b151 not taken ($014e := $014d)
test("loc_b131: $014d >= $30 decremented, $014e clamped up to $014d", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x014d] = 0x40;            // >= $30 -> sbc #1 (carry set by cmp) -> 0x3f, stored
  m.ram[0x014e] = 0x10;            // 0x10-1 = 0x0f < 0x3f -> bcs $b151 not taken -> $014e := $014d
  loc_b131(m);
  assert.deepEqual(m.calls, [0xb15a]);
  assert.deepEqual(m.retAddrs, [0xb137]);
  assert.equal(m.ram[0x014d], 0x3f, "$014d decremented (0x40-1)");
  assert.equal(m.ram[0x014e], 0x3f, "$014e clamped to $014d (0x0f < 0x3f)");
  assert.equal(m.regs.a, 0x3f, "A reloaded from $014d");
  assert.equal(m.regs.x, 0x4e);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 56, "16 + (bcc2+sbc2+sta4) + cmp2 + bcs2 + 12 + bcs2 + lda4 + sta4 + rts6");
});

// bcs $b146 taken: decremented $014d result >= $80 -> early rts, $014e untouched
test("loc_b131: $014d result >= $80 -> early rts, $014e untouched", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x014d] = 0x81;            // >= $30 -> 0x81-1 = 0x80, stored; cmp #$80 -> carry set -> bcs taken
  m.ram[0x014e] = 0x77;            // must stay untouched (never reached)
  loc_b131(m);
  assert.deepEqual(m.calls, [0xb15a]);
  assert.deepEqual(m.retAddrs, [0xb137]);
  assert.equal(m.ram[0x014d], 0x80, "$014d decremented to 0x80");
  assert.equal(m.ram[0x014e], 0x77, "$014e untouched (early rts before the second clamp)");
  assert.equal(m.regs.a, 0x80, "A = decremented $014d");
  assert.equal(m.regs.fC, true, "cmp #$80 set carry (0x80 >= 0x80)");
  assert.equal(m.regs.fZ, true, "cmp #$80 equal -> Z set");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 35, "16 + (bcc2+sbc2+sta4) + cmp2 + bcs3 + rts6");
});
