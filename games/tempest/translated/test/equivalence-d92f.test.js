// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d92f (ROM 0xd92f) -- `eor (0x00),y` then falls through into loc_d931.
// Run: node --test games/tempest/translated/test/equivalence-d92f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d92f } from "../loc_d92f.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    call(target) { this.calls.push(target); }, // record fall-through/tail target; do not execute it
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
  };
}

test("loc_d92f: eor (0x00),y via ptr [0x00/0x01]+y, falls through to loc_d931, 5 T", () => {
  const m = makeMachine();
  m.mem.write8(0x00, 0x34);   // ptr low
  m.mem.write8(0x01, 0x12);   // ptr high -> 0x1234
  m.regs.y = 0x05;            // eff = 0x1239
  m.mem.write8(0x1239, 0x0f);
  m.regs.a = 0xff;

  loc_d92f(m);

  assert.equal(m.regs.a, 0xf0, "0xff ^ 0x0f = 0xf0");
  assert.equal(m.regs.fN, true, "0xf0 -> N set");
  assert.equal(m.regs.fZ, false, "0xf0 -> Z clear");
  assert.equal(m.pc, 0xd931, "PC advances to loc_d931 entry");
  assert.deepEqual(m.calls, [0xd931], "fall-through delegates to loc_d931");
  assert.equal(m.cycles, 5, "(zp),y = 5 T");
});

test("loc_d92f: ptr_lo + Y carries into next page -> 6 T", () => {
  const m = makeMachine();
  m.mem.write8(0x00, 0xf0);   // ptr low
  m.mem.write8(0x01, 0x12);   // ptr high -> 0x12f0
  m.regs.y = 0x20;            // eff = 0x1310 -> crosses page 0x12 -> 0x13
  m.mem.write8(0x1310, 0x0f);
  m.regs.a = 0xff;

  loc_d92f(m);

  assert.equal(m.regs.a, 0xf0, "0xff ^ 0x0f = 0xf0");
  assert.equal(m.pc, 0xd931, "PC advances to loc_d931 entry");
  assert.equal(m.cycles, 6, "(zp),y with page cross = 6 T");
});

test("loc_d92f: eor to 0x00 sets Z (A == operand)", () => {
  const m = makeMachine();
  m.mem.write8(0x00, 0x00);
  m.mem.write8(0x01, 0x08);   // ptr -> 0x0800
  m.regs.y = 0x00;            // eff = 0x0800
  m.mem.write8(0x0800, 0x5a);
  m.regs.a = 0x5a;

  loc_d92f(m);

  assert.equal(m.regs.a, 0x00, "0x5a ^ 0x5a = 0x00");
  assert.equal(m.regs.fZ, true, "Z set");
  assert.equal(m.regs.fN, false, "N clear");
});
