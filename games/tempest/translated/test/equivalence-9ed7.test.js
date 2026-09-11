// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9ed7 (ROM 0x9ed7-0x9ef0) -- returns $03ee[y]|0x80; bit6 of A picks the
// transformed path (y=(y-1)&0x0f, ($03ee[y]+8)&0x0f) vs the plain-load path. No JSRs in this routine.
// Run: node --test games/tempest/translated/test/equivalence-9ed7.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9ed7 } from "../loc_9ed7.js";

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

test("bit6 set -> y=(y-1)&0x0f, ($03ee[y]+8)&0x0f | 0x80", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x40;            // bit6 set -> beq not taken (transform path)
  m.regs.y = 0x05;            // -> y = 0x04
  m.ram[0x03ee + 0x04] = 0x0a;
  loc_9ed7(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.y, 0x04, "y = (5-1) & 0x0f");
  assert.equal(m.regs.a, 0x82, "((0x0a + 8) & 0x0f) | 0x80 = 0x02 | 0x80");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 35);
});

test("bit6 set, dey wraps y=0 -> 0x0f", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0xc0;            // bit6 (and other) set
  m.regs.y = 0x00;            // dey -> 0xff, & 0x0f -> 0x0f
  m.ram[0x03ee + 0x0f] = 0x09;
  loc_9ed7(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.y, 0x0f, "wrapped index");
  assert.equal(m.regs.a, 0x81, "((0x09 + 8) & 0x0f) | 0x80 = 0x01 | 0x80");
  assert.equal(m.cycles, 35);
});

test("bit6 clear -> beq taken, plain $03ee[y] | 0x80, y untouched (no page cross)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x3f;            // bit6 clear -> beq taken
  m.regs.y = 0x03;
  m.ram[0x03ee + 0x03] = 0x25;
  loc_9ed7(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.y, 0x03, "y unchanged on plain path");
  assert.equal(m.regs.a, 0xa5, "0x25 | 0x80");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 17);
});

test("bit6 clear, page-cross edge at 9eeb (y=0x12 -> 0x0400)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.a = 0x00;            // bit6 clear
  m.regs.y = 0x12;            // 0x03ee + 0x12 = 0x0400 -> page cross
  m.ram[0x0400] = 0x07;
  loc_9ed7(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.a, 0x87, "0x07 | 0x80");
  assert.equal(m.regs.y, 0x12, "y untouched");
  assert.equal(m.cycles, 18, "17 + 1 page-cross on abs,y load");
});
