// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_dd41 (ROM 0xdd41-0xdddb). Author-derived 6502 harness; the dce6 stub deposits
// A/Y so the $0412/$0413 writes are checkable; df39/dfb1/df75 are opaque recorded calls. Cycles are not
// asserted (data-dependent nested loops); the whole-machine boot-first diff vs MAME pins timing.
// Run: node --test games/tempest/translated/test/equivalence-dd41.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_dd41 } from "../loc_dd41.js";

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
    call(a) {
      this.calls.push(a);
      if (this._retPushed) { this._retPushed = false; this.pull16(); }
      if (a === 0xdce6) { regs.a = 0x12; regs.y = 0x00; } // deposit -> stored to $0412/$0413
      return undefined;
    },
  };
}

test("loc_dd41: prologue 16-bit add ($6095/$6096), $608d, dce6/df39, 5-pass double-dabble, rts", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x4000); // rts -> 0x4001
  // prologue inputs
  m.mem.write8(0x040f, 0x03); m.mem.write8(0x0410, 0x01); // ($0410:$040f)<<1 = 0x0206
  m.mem.write8(0x040c, 0x10); m.mem.write8(0x040d, 0x20); // + 0x2010 -> 0x2216
  m.mem.write8(0x0409, 0x55);
  m.mem.write8(0x040a, 0xaa); m.mem.write8(0x040b, 0xbb); // -> dce6 args
  // pass E table: $3b reaches $0412 (=dce6 A), $0413 (=dce6 Y), $0414 -> value 0x000012 = 18
  m.mem.write8(0x0414, 0x00);

  loc_dd41(m);

  // prologue: $29 = 0x03<<1 = 0x06; $6095 = $040c + $29 = 0x16; $6096 = $040d + $2a(0x02) = 0x22
  assert.equal(m.mem.read8(0x6095), 0x16, "$6095 = low byte of the 16-bit sum");
  assert.equal(m.mem.read8(0x6096), 0x22, "$6096 = high byte");
  assert.equal(m.mem.read8(0x608d), 0x55, "$608d = $0409");
  assert.equal(m.mem.read8(0x0412), 0x12, "$0412 = dce6 A");
  assert.equal(m.mem.read8(0x0413), 0x00, "$0413 = dce6 Y");
  // pass E: binary 0x000012 (=18) -> BCD 0x18 in $31, higher bytes 0
  assert.equal(m.mem.read8(0x0031), 0x18, "double-dabble of 18 -> BCD $18");
  assert.equal(m.mem.read8(0x0032), 0x00, "$32 = 0");
  assert.equal(m.mem.read8(0x0033), 0x00, "$33 = 0");
  assert.equal(m.mem.read8(0x0034), 0x00, "$34 = 0");
  assert.equal(m.regs.fD, false, "cld cleared decimal mode before returning");
  // call sequence: dce6, df39, then (dfb1, df75) x5
  assert.equal(m.calls[0], 0xdce6, "first jsr dce6");
  assert.equal(m.calls[1], 0xdf39, "then jsr df39");
  assert.deepEqual(m.calls.slice(2), [0xdfb1, 0xdf75, 0xdfb1, 0xdf75, 0xdfb1, 0xdf75, 0xdfb1, 0xdf75, 0xdfb1, 0xdf75],
    "5 passes of jsr dfb1 then jsr df75");
  assert.equal(m.pc, 0x4001, "rts -> pushed + 1");
});

test("loc_dd41: zero 16-bit sum forces $6095 = 1 (bne not taken)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x4000);
  // all of $0409-$0410 zero -> sum 0 -> ora $29 == 0 -> lda #1 / sta $6095
  loc_dd41(m);
  assert.equal(m.mem.read8(0x6095), 0x01, "zero sum -> $6095 forced to 1");
  assert.equal(m.mem.read8(0x6096), 0x00, "$6096 high byte still 0");
});
