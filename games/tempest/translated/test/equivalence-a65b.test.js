// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a65b (ROM 0xa65b-0xa69a) -- spawn into slot x: seed $0263/$0283/$02a3,x=0x80,
// fill velocity/coord pairs from $60ca/$60da and three jsr $a69b random steps (middle one made negative
// unless already negative), then jsr $ccc1. and #$00 makes the leading bne dead (never returns early).
// All abs,x here are STORES (fixed 5T, no page-cross); the only calls are $a69b x3 and $ccc1.
// Run: node --test games/tempest/translated/test/equivalence-a65b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a65b } from "../loc_a65b.js";

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

// model jsr $a69b (and $ccc1) returning a fixed value in A with matching N/Z
function mockReturn(m, val) {
  const orig = m.call.bind(m);
  m.call = (a) => { orig(a); m.regs.a = val & 0xff; m.regs.setNZ(val & 0xff); };
}

// a69b returns positive 0x05 -> bmi not taken -> $0343,x = two's-complement negate = 0xfb
test("spawn slot 0, a69b positive -> middle step negated", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x03] = 0xff;              // and #$00 masks it -> bne never taken
  m.ram[0x60da] = 0x11; m.ram[0x60ca] = 0x22;
  mockReturn(m, 0x05);
  loc_a65b(m);
  assert.deepEqual(m.calls, [0xa69b, 0xa69b, 0xa69b, 0xccc1]);
  assert.deepEqual(m.retAddrs, [0xa674, 0xa680, 0xa693, 0xa699], "each jsr pushes addr+2");
  assert.equal(m.ram[0x0263], 0x80); assert.equal(m.ram[0x0283], 0x80); assert.equal(m.ram[0x02a3], 0x80);
  assert.equal(m.ram[0x02c3], 0x11, "$02c3 <- $60da");
  assert.equal(m.ram[0x0323], 0x05, "$0323 <- a69b");
  assert.equal(m.ram[0x02e3], 0x22, "$02e3 <- $60ca");
  assert.equal(m.ram[0x0343], 0xfb, "$0343 <- negate(0x05) (bmi not taken)");
  assert.equal(m.ram[0x0303], 0x22, "$0303 <- $60ca");
  assert.equal(m.ram[0x0363], 0x05, "$0363 <- a69b");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 104);
});

// a69b returns negative 0x80 -> bmi taken -> $0343,x kept as-is; slot x=2 shows indexing
test("spawn slot 2, a69b negative -> bmi taken keeps value", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x02;
  m.ram[0x03] = 0x00;
  m.ram[0x60da] = 0x11; m.ram[0x60ca] = 0x22;
  mockReturn(m, 0x80);
  loc_a65b(m);
  assert.deepEqual(m.calls, [0xa69b, 0xa69b, 0xa69b, 0xccc1]);
  assert.deepEqual(m.retAddrs, [0xa674, 0xa680, 0xa693, 0xa699]);
  assert.equal(m.ram[0x0265], 0x80, "$0263,x with x=2");
  assert.equal(m.ram[0x0325], 0x80, "$0323,x <- a69b");
  assert.equal(m.ram[0x0345], 0x80, "$0343,x kept (bmi taken, no negate)");
  assert.equal(m.ram[0x0365], 0x80, "$0363,x <- a69b");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 99);
});
