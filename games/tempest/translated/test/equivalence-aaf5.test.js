// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_aaf5 (ROM 0xaaf5) -- BCD double-dabble: shift $29 left 8x, doubling $2c in
// decimal per shifted-out bit (binary-to-BCD of the input A, low two digits). Minimal 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-aaf5.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_aaf5 } from "../loc_aaf5.js";

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

test("loc_aaf5: A=0x01 -> BCD 01 in $2c and $29; decimal cleared; 181 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // rts -> 0x1234
  m.regs.a = 0x01;

  loc_aaf5(m);

  assert.equal(m.mem.read8(0x2c), 0x01, "$2c = BCD of 1 = 0x01");
  assert.equal(m.mem.read8(0x29), 0x01, "$29 restored to the last accumulator (=$2c)");
  assert.equal(m.regs.fD, false, "cld cleared decimal mode");
  assert.equal(m.pc, 0x1234, "rts returns to pushed + 1");
  // 12 (prologue) + [7 taken iters *(16+4)] + [1 iter *(16+2)] + 11 (epilogue)
  assert.equal(m.cycles, 12 + 7 * 20 + 18 + 11, "181 T");
});

test("loc_aaf5: A=0x00 -> $2c stays 0, $29=0", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.regs.a = 0x00;

  loc_aaf5(m);

  assert.equal(m.mem.read8(0x2c), 0x00, "no bits shifted out -> $2c = 0");
  assert.equal(m.mem.read8(0x29), 0x00, "$29 = 0");
  assert.equal(m.pc, 0x2001, "rts");
});

test("loc_aaf5: A=0x63 (binary 99) -> BCD 0x99", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.regs.a = 0x63; // 99 decimal

  loc_aaf5(m);

  assert.equal(m.mem.read8(0x2c), 0x99, "double-dabble of 99 -> BCD 0x99");
});
