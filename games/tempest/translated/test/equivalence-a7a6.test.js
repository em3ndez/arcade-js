// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a7a6 (ROM 0xa7a6-0xa7bb) -- $2a = A-Y; if $0111 bit7 set, return raw delta;
// else mask to low nibble and, if delta bit3 set (bit 0xa7bc = ROM 0x08), sign-extend with ora #0xf8.
// Minimal 6502 harness; whole-machine boot-first state diff vs MAME is the integration check.
// Run: node --test games/tempest/translated/test/equivalence-a7a6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a7a6 } from "../loc_a7a6.js";

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

function setup(ram) {
  ram[0xa7bc] = 0x08; // the ROM constant read by `bit 0xa7bc`
}

test("loc_a7a6: $0111 bit7 set -> BMI, return raw delta A-Y, 24 T", () => {
  const m = makeMachine();
  setup(m.ram);
  m.regs.s = 0xfd;
  m.push16(0x3000); // RTS -> 0x3001
  m.regs.a = 0x30;
  m.regs.y = 0x10;
  m.ram[0x0111] = 0x80; // bit7 set -> bmi taken

  loc_a7a6(m);

  assert.equal(m.ram[0x2a], 0x20, "$2a = A - Y = 0x20");
  assert.equal(m.regs.a, 0x20, "A unchanged after bmi (raw delta)");
  assert.equal(m.pc, 0x3001, "RTS -> pushed + 1");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.cycles, 3 + 2 + 3 + 3 + 4 + 3 + 6, "24 T (bmi taken path)");
});

test("loc_a7a6: bit7 clear, delta bit3 set -> ora #0xf8, 33 T", () => {
  const m = makeMachine();
  setup(m.ram);
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.regs.a = 0x10;
  m.regs.y = 0x02; // A-Y = 0x0e (bit3 set)
  m.ram[0x0111] = 0x00; // bmi not taken

  loc_a7a6(m);

  assert.equal(m.ram[0x2a], 0x0e, "$2a = 0x0e");
  assert.equal(m.regs.a, 0xfe, "0x0e & 0x0f = 0x0e, bit3 set -> ora 0xf8 = 0xfe");
  assert.equal(m.pc, 0x3001, "RTS -> pushed + 1");
  assert.equal(m.cycles, 3 + 2 + 3 + 3 + 4 + 2 + 2 + 4 + 2 + 2 + 6, "33 T");
});

test("loc_a7a6: bit7 clear, delta bit3 clear -> BEQ skips ora, 32 T", () => {
  const m = makeMachine();
  setup(m.ram);
  m.regs.s = 0xfd;
  m.push16(0x3000);
  m.regs.a = 0x10;
  m.regs.y = 0x0c; // A-Y = 0x04 (bit3 clear)
  m.ram[0x0111] = 0x00;

  loc_a7a6(m);

  assert.equal(m.ram[0x2a], 0x04, "$2a = 0x04");
  assert.equal(m.regs.a, 0x04, "bit3 clear -> beq taken, ora skipped, A = 0x04");
  assert.equal(m.pc, 0x3001, "RTS -> pushed + 1");
  assert.equal(m.cycles, 3 + 2 + 3 + 3 + 4 + 2 + 2 + 4 + 3 + 6, "32 T");
});
