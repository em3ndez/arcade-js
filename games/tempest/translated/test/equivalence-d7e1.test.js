// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_d7e1 (ROM 0xd7e1-0xd803) -- three guards ($01ca, $0c00&0x10, $01c9&0x03)
// gate a tail jsr $abac; every guard has both directions + the branch page-cross cycle counts covered.
// Run: node --test games/tempest/translated/test/equivalence-d7e1.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_d7e1 } from "../loc_d7e1.js";

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

// guard 1: $01ca != 0 -> bne taken (page cross) -> straight to rts, no jsr
test("$01ca != 0 -> bne taken -> rts, no delegate", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x01ca] = 0x01;
  loc_d7e1(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x05], 0x00, "$05 set before the guard");
  assert.equal(m.ram[0x01], 0x02, "$01 set before the guard");
  assert.equal(m.ram[0x00], 0x00, "$00 NOT written (never reached)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 24);
});

// guard 2: $01ca == 0, ($0c00 & 0x10) == 0 -> beq taken (page cross) -> rts, no jsr
test("$0c00 bit4 clear -> beq taken -> rts, no delegate", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x01ca] = 0x00;
  m.ram[0x0c00] = 0x00;           // & 0x10 == 0
  loc_d7e1(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x00], 0x00, "$00 still 0 (not yet written at this guard)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 32);
});

// guard 3: first two pass, ($01c9 & 0x03) == 0 -> beq taken (same page) -> rts, no jsr
test("$01c9 low2 clear -> beq taken -> rts, no delegate", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x01ca] = 0x00;
  m.ram[0x0c00] = 0x10;           // bit4 set -> beq NOT taken
  m.ram[0x00] = 0xee;            // proves $00 gets overwritten to 0x00
  m.ram[0x01c9] = 0x04;           // & 0x03 == 0
  loc_d7e1(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x00], 0x00, "$00 written 0 past the second guard");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 44);
});

// all guards pass -> jsr $abac delegate (pushes 0xd800+2 = 0xd802), then rts
test("all guards pass -> jsr $abac delegate", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x01ca] = 0x00;
  m.ram[0x0c00] = 0x10;           // bit4 set
  m.ram[0x01c9] = 0x01;           // & 0x03 != 0 -> beq NOT taken -> jsr
  loc_d7e1(m);
  assert.deepEqual(m.calls, [0xabac]);
  assert.equal(m.retAddrs[0], 0xd802, "jsr $abac pushes addr+2 (0xd800+2)");
  assert.equal(m.ram[0x00], 0x00);
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 49);
});
