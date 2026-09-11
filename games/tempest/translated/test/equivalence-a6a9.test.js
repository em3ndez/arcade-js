// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a6a9 (ROM 0xa6a9-0xa720) -- integrates slot x's 3 motion axes: fraction += vel-low
// (carry kept), whole = vel-whole + whole + carry, clamped to the ring [$10,$f0). Axis 0's whole -> $0283,x.
// Run: node --test games/tempest/translated/test/equivalence-a6a9.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a6a9 } from "../loc_a6a9.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

// axis0 positive vel-whole, no clamp; axes 1/2 no clamp -> Y = vel-whole0 + whole0 carries through to $0283,x
test("all axes add, no clamp", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x02e3] = 0x05; m.ram[0x0223] = 0x10; m.ram[0x0343] = 0x00; m.ram[0x0283] = 0x20;
  m.ram[0x02c3] = 0x05; m.ram[0x0203] = 0x10; m.ram[0x0323] = 0x00; m.ram[0x0263] = 0x20;
  m.ram[0x0303] = 0x05; m.ram[0x0243] = 0x10; m.ram[0x0363] = 0x00; m.ram[0x02a3] = 0x20;
  loc_a6a9(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0223], 0x15, "axis0 fraction = 0x10 + 0x05");
  assert.equal(m.ram[0x0283], 0x20, "axis0 whole = 0x00 + 0x20 + carry(0), via Y");
  assert.equal(m.ram[0x0263], 0x20, "axis1 whole");
  assert.equal(m.ram[0x02a3], 0x20, "axis2 whole");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 130);
});

// axis0 vel-whole negative (bmi taken) -> cmp #$10/bcs keep branch
test("axis0 bmi (neg vel-whole), bcs keep", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x02e3] = 0x05; m.ram[0x0223] = 0x10; m.ram[0x0343] = 0x80; m.ram[0x0283] = 0x50;
  loc_a6a9(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0283], 0xd0, "0x80 + 0x50 = 0xd0 (>= 0x10, kept)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 126);
});

// axis0 non-bmi, sum hits >= $f0 -> bcc not taken -> lda #0 clamp
test("axis0 clamp at $f0 -> whole reset to 0", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x0343] = 0x00; m.ram[0x0283] = 0xf0;
  loc_a6a9(m);
  assert.equal(m.ram[0x0283], 0x00, "0x00 + 0xf0 >= 0xf0 -> reset");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 131);
});

// axis0 bmi taken AND sum < $10 -> bcs not taken -> lda #0 clamp
test("axis0 bmi clamp at $10 -> whole reset to 0", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x0343] = 0xff; m.ram[0x0283] = 0x05;
  loc_a6a9(m);
  assert.equal(m.ram[0x0283], 0x00, "0xff + 0x05 = 0x04 < 0x10 -> reset");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 127);
});

// axis1 non-bmi overflow -> ldy #0 zeroes Y; store $0263,x keeps the (unclamped) sum; final $0283,x := 0
test("axis1 ldy#0 overflow zeroes final $0283 but keeps $0263 sum", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x00;
  m.ram[0x0283] = 0x50;            // axis0 -> Y = 0x50
  m.ram[0x0263] = 0xf0; m.ram[0x0323] = 0x00; // axis1: 0x00 + 0xf0 >= 0xf0 -> ldy #0
  loc_a6a9(m);
  assert.equal(m.ram[0x0263], 0xf0, "axis1 store keeps the sum (ldy only zeroed Y)");
  assert.equal(m.ram[0x0283], 0x00, "Y zeroed by axis1 clamp -> $0283 := 0");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 131);
});

// page-cross edge: x=0x80 pushes abs,x loads across page boundaries (+1 each crossing load)
test("edge: abs,x page cross adds cycles", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000); m.regs.x = 0x80;
  m.ram[0x0363] = 0x05; m.ram[0x02a3] = 0x10; // 0x02e3+0x80, 0x0223+0x80
  loc_a6a9(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x02a3], 0x15, "axis0 fraction store at 0x0223+0x80");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 134);
});
