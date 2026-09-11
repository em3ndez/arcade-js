// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9f81 (ROM 0x9f81-0x9fc3) -- entry 0x9f81 (jsr $9d67, jsr $9c4f, jmp $9f99) and
// entry 0x9f8a (seed bit6 of $0283,x from POKEY1 RANDOM $60ca, join $9f99). Shared tail toggles bit6 of
// $0283,x under a $0111 / $02b9,x test, sets $010b=$66, and tail-jmps $9e5f (loc_9e5c body).
// Run: node --test games/tempest/translated/test/equivalence-9f81.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9f81, loc_9f8a } from "../loc_9f81.js";

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
    // record each JSR's pushed return addr (must be jsraddr+2) so a wrong push16 fails, then pop to balance S
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

test("entry 0x9f8a: bit6 clear in RANDOM -> and #$bf clears bit6 (bit7 kept), $0111==0 -> beq tail", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0283] = 0xf0;   // 1111_0000; and #$bf -> 1011_0000 = 0xb0
  m.ram[0x60ca] = 0x00;   // RANDOM bit6 clear -> V clear -> bvc taken (skip ora)
  m.ram[0x0111] = 0x00;   // beq $9fbc taken (shortest tail)
  loc_9f8a(m);
  assert.equal(m.ram[0x0283], 0xb0, "bit6 cleared, bit7 preserved");
  assert.equal(m.ram[0x010b], 0x66, "$010b <- $66");
  assert.equal(m.pc, 0x9e5f, "tail jmp -> $9e5f");
  assert.deepEqual(m.calls, [0x9e5f]);
  assert.deepEqual(m.retAddrs ?? [], [], "no jsr on the 0x9f8a path");
  assert.equal(m.cycles, 34);
});

test("entry 0x9f8a: RANDOM bit6 set -> ora #$40 sets bit6, $0111==0 -> beq tail", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;
  m.ram[0x60ca] = 0x40;   // RANDOM bit6 set -> V set -> ora #$40
  m.ram[0x0111] = 0x00;
  loc_9f8a(m);
  assert.equal(m.ram[0x0283], 0x40, "bit6 set from RANDOM");
  assert.equal(m.ram[0x010b], 0x66);
  assert.equal(m.cycles, 35);
});

test("entry 0x9f81: jsr $9d67 then jsr $9c4f (each pushes addr+2), jmp $9f99, $0111==0 -> beq tail", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0111] = 0x00;   // beq tail
  loc_9f81(m);
  assert.deepEqual(m.calls, [0x9d67, 0x9c4f, 0x9e5f]);
  assert.equal(m.retAddrs[0], 0x9f83, "jsr $9d67 pushes 0x9f81+2");
  assert.equal(m.retAddrs[1], 0x9f86, "jsr $9c4f pushes 0x9f84+2");
  assert.equal(m.retAddrs.length, 2, "only the two jsrs push (the jmp does not)");
  assert.equal(m.ram[0x010b], 0x66);
  assert.equal(m.pc, 0x9e5f, "tail jmp -> $9e5f");
  assert.equal(m.cycles, 31);
});

test("tail: bit6 clear + $02b9,x >= $0f -> bcs, toggle bit6 (eor #$40)", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x30;   // bit6 clear
  m.ram[0x60ca] = 0x00;   // V clear -> stored 0x30 unchanged
  m.ram[0x0111] = 0x01;   // beq not taken
  m.ram[0x02b9] = 0x20;   // >= 0x0f -> bcs taken -> toggle
  loc_9f8a(m);
  assert.equal(m.ram[0x0283], 0x70, "0x30 eor 0x40 -> 0x70");
  assert.equal(m.ram[0x010b], 0x66);
  assert.deepEqual(m.calls, [0x9e5f]);
  assert.equal(m.cycles, 61);
});

test("tail: bit6 clear + $02b9,x < $0f -> bcs not taken -> clv;bvc, no toggle", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x30;
  m.ram[0x60ca] = 0x00;
  m.ram[0x0111] = 0x01;
  m.ram[0x02b9] = 0x05;   // < 0x0f -> no toggle
  loc_9f8a(m);
  assert.equal(m.ram[0x0283], 0x30, "unchanged");
  assert.equal(m.cycles, 54);
});

test("tail: bit6 set + $02b9,x != 0 -> bne $9fbc, no toggle", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;
  m.ram[0x60ca] = 0x40;   // V set -> stored 0x40 (bit6 set)
  m.ram[0x0111] = 0x01;
  m.ram[0x02b9] = 0x05;   // nonzero -> bne $9fbc
  loc_9f8a(m);
  assert.equal(m.ram[0x0283], 0x40, "unchanged");
  assert.equal(m.cycles, 50);
});

test("tail: bit6 set + $02b9,x == 0 -> bne not taken -> toggle bit6", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x0283] = 0x00;
  m.ram[0x60ca] = 0x40;   // V set -> stored 0x40
  m.ram[0x0111] = 0x01;
  m.ram[0x02b9] = 0x00;   // zero -> fall to toggle
  loc_9f8a(m);
  assert.equal(m.ram[0x0283], 0x00, "0x40 eor 0x40 -> 0x00");
  assert.equal(m.cycles, 60);
});

test("edge: abs,x page cross (x=0x80) adds +1 per crossing load, toggle path", () => {
  const m = makeMachine();
  m.regs.x = 0x80;        // 0x0283+0x80=0x0303 and 0x02b9+0x80=0x0339 cross into page 0x03
  m.ram[0x0303] = 0x30;
  m.ram[0x60ca] = 0x00;   // V clear -> stored 0x30
  m.ram[0x0111] = 0x01;
  m.ram[0x0339] = 0x20;   // >= 0x0f -> toggle
  loc_9f8a(m);
  assert.equal(m.ram[0x0303], 0x70, "toggled at 0x0283,x");
  assert.deepEqual(m.calls, [0x9e5f]);
  assert.equal(m.cycles, 65);
});
