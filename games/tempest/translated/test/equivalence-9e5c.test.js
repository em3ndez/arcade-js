// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9e5c (ROM 0x9e5c-0x9eaa) -- per-slot(x) step. Prologue jsr $9eab, set bit7 of
// $0283,x. segment = $0283,x & 7. seg==4: bit6 picks decrement $02b9,x + $02cc,x=$87 / else $02cc,x=$81.
// seg!=4: bit6 set increments $02b9,x, then $02cc,x = jsr $9ed7(A=$0283,x, Y=$02b9,x).
// Run: node --test games/tempest/translated/test/equivalence-9e5c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9e5c } from "../loc_9e5c.js";

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
    // record each JSR's pushed return address (must be jsraddr+2), then pop to balance S
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("seg != 4, bit6 clear -> beq taken (skip increment) -> jsr $9ed7", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;           // ora $80 -> 0x80; &7 = 0 != 4
  m.ram[0x02b9] = 0x05;           // Y source
  loc_9e5c(m);
  assert.equal(m.ram[0x0283], 0x80, "bit7 set");
  assert.equal(m.ram[0x02b9], 0x05, "$02b9 untouched (no increment)");
  assert.equal(m.ram[0x02cc], 0x80, "$02cc = A from lda $0283,x (mock jsr leaves A)");
  assert.equal(m.regs.y, 0x05, "Y = $02b9,x");
  assert.deepEqual(m.calls, [0x9eab, 0x9ed7]);
  assert.equal(m.retAddrs[0], 0x9e5e, "jsr $9eab pushes 0x9e5c+2");
  assert.equal(m.retAddrs[1], 0x9ea6, "jsr $9ed7 pushes 0x9ea4+2");
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 58);
});

test("seg != 4, bit6 set -> beq not taken -> increment $02b9,x (mod 16) -> jsr $9ed7", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x40;           // ora $80 -> 0xc0; &7 = 0 != 4; bit6 set
  m.ram[0x02b9] = 0x05;
  loc_9e5c(m);
  assert.equal(m.ram[0x02b9], 0x06, "$02b9 incremented");
  assert.equal(m.ram[0x02cc], 0xc0, "$02cc = A from lda $0283,x");
  assert.equal(m.regs.y, 0x06, "Y = incremented $02b9,x");
  assert.deepEqual(m.calls, [0x9eab, 0x9ed7]);
  assert.equal(m.retAddrs[1], 0x9ea6, "jsr $9ed7 pushes 0x9ea4+2");
  assert.equal(m.cycles, 72);
});

test("increment wraps mod 16: $02b9 = 0x0f -> 0x00", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x40;
  m.ram[0x02b9] = 0x0f;
  loc_9e5c(m);
  assert.equal(m.ram[0x02b9], 0x00, "0x0f + 1 & 0x0f wraps to 0");
});

test("seg == 4, bit6 set -> bne taken -> decrement $02b9,x (mod 16), $02cc=$87, no jsr $9ed7", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x44;           // ora $80 -> 0xc4; &7 = 4; bit6 set
  m.ram[0x02b9] = 0x05;
  loc_9e5c(m);
  assert.equal(m.ram[0x02b9], 0x04, "$02b9 decremented");
  assert.equal(m.ram[0x02cc], 0x87, "$02cc = $87");
  assert.deepEqual(m.calls, [0x9eab], "no jsr $9ed7 on seg==4 path");
  assert.equal(m.retAddrs[0], 0x9e5e, "jsr $9eab pushes 0x9e5c+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 65);
});

test("decrement wraps mod 16: $02b9 = 0x00 -> 0x0f", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x44;
  m.ram[0x02b9] = 0x00;
  loc_9e5c(m);
  assert.equal(m.ram[0x02b9], 0x0f, "0x00 - 1 & 0x0f wraps to 0x0f");
});

test("seg == 4, bit6 clear -> else path -> $02cc=$81, $02b9 untouched", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x04;           // ora $80 -> 0x84; &7 = 4; bit6 clear
  m.ram[0x02b9] = 0x05;
  loc_9e5c(m);
  assert.equal(m.ram[0x02cc], 0x81, "$02cc = $81");
  assert.equal(m.ram[0x02b9], 0x05, "$02b9 untouched");
  assert.deepEqual(m.calls, [0x9eab]);
  assert.equal(m.cycles, 54);
});

test("edge: abs,x page cross adds +1 per crossing load (seg != 4, beq taken)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;                // $0283+0x80=0x0303 crosses page; $02b9+0x80=0x0339 crosses
  m.ram[0x0303] = 0x00;           // ora $80 -> 0x80; &7 = 0 != 4; bit6 clear
  m.ram[0x0339] = 0x07;           // Y source
  loc_9e5c(m);
  assert.equal(m.ram[0x0303], 0x80, "bit7 set at crossed address");
  assert.equal(m.ram[0x034c], 0x80, "$02cc,x = A written at crossed address");
  assert.equal(m.regs.y, 0x07);
  assert.deepEqual(m.calls, [0x9eab, 0x9ed7]);
  assert.equal(m.retAddrs[1], 0x9ea6);
  assert.equal(m.cycles, 62, "58 base + 4 crossing loads (0x0283,0x0283,0x0283,0x02b9)");
});
