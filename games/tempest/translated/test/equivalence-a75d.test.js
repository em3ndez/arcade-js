// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a75d (ROM 0xa75d-0xa787) -- steps one signed 16-bit velocity ($2b:A) toward zero
// by the fixed step $a788 (=$20): whole<0 adds, else subtracts; on crossing zero inc $29 and force low = 0.
// Run: node --test games/tempest/translated/test/equivalence-a75d.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a75d } from "../loc_a75d.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  ram[0xa788] = 0x20; // ROM constant read by sbc/adc $a788 (the step)
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

// whole (Y) positive -> subtract path, no borrow -> bcc not taken -> bvc $a784
test("positive whole: subtract step, no cross", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x50; m.regs.y = 0x02;         // $0250 - $0020 = $0230
  loc_a75d(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.a, 0x30, "low = 0x50 - 0x20");
  assert.equal(m.regs.y, 0x02, "whole unchanged");
  assert.equal(m.ram[0x2a], 0x30);
  assert.equal(m.ram[0x2b], 0x02);
  assert.equal(m.ram[0x29], 0x00, "no saturation");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 40);
});

// positive whole, subtract crosses zero -> bcc taken -> saturate (inc $29, low := 0, whole := 0)
test("positive whole: subtract crosses zero -> saturate", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x10; m.regs.y = 0x00;         // $0010 - $0020 -> borrow
  loc_a75d(m);
  assert.equal(m.regs.a, 0x00, "low forced to 0");
  assert.equal(m.regs.y, 0x00, "whole forced to 0");
  assert.equal(m.ram[0x2a], 0x00);
  assert.equal(m.ram[0x29], 0x01, "$29 incremented");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 46);
});

// whole negative (bit7 set) -> add path, no carry out -> bcc taken -> $a784
test("negative whole: add step, no cross", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x50; m.regs.y = 0xfe;         // $fe50 + $0020 = $fe70
  loc_a75d(m);
  assert.equal(m.regs.a, 0x70, "low = 0x50 + 0x20");
  assert.equal(m.regs.y, 0xfe, "whole unchanged");
  assert.equal(m.ram[0x2a], 0x70);
  assert.equal(m.ram[0x2b], 0xfe);
  assert.equal(m.ram[0x29], 0x00);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 37);
});

// whole negative, add carries out of 16 bits -> bcc not taken -> saturate
test("negative whole: add crosses zero -> saturate", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0xf0; m.regs.y = 0xff;         // $fff0 + $0020 = $0010 -> cross
  loc_a75d(m);
  assert.equal(m.regs.a, 0x00, "low forced to 0");
  assert.equal(m.regs.y, 0x00, "whole forced to 0");
  assert.equal(m.ram[0x2a], 0x00);
  assert.equal(m.ram[0x29], 0x01, "$29 incremented");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 46);
});
