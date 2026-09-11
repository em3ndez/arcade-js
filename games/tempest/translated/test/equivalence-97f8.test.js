// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_97f8 (ROM 0x97f8-0x98a1) -- per-frame step of the moving object: two negative
// guards, sound seeds ($ccee/$ccf2), a clamped 16-bit position ($0107/$0202), a table reset ($a7bd), a
// second accumulator ($5c/$5f/$5b/$0114), a $9f-derived speed recompute, and a slot scan ($03ac,x -> hit
// jsr $cd06/$a347/$928f). Run: node --test games/tempest/translated/test/equivalence-97f8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_97f8 } from "../loc_97f8.js";

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
    // record the JSR's pushed return address (must be jsraddr+2) so a wrong push16 fails, then pop to balance S
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; (this.retAddrs ||= []).push(this.pull16()); } return undefined; },
  };
}

// guard 1: $0201 negative -> bpl not taken -> immediate rts
test("$0201 negative -> bpl not taken -> rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0201] = 0x80;             // negative -> fN set -> bpl not taken
  loc_97f8(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 12);
});

// guard 2: $0201 positive but $0106 positive -> bmi not taken -> rts
test("$0201 positive, $0106 positive -> bmi not taken -> rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0201] = 0x00;             // positive -> bpl taken
  m.ram[0x0106] = 0x00;             // positive -> bmi not taken
  loc_97f8(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 19);
});

// main flow, $0202 != $10 (no $ccee), in range, below $50, no reset, no clamp, empty slot scan -> clean rts
test("full pass, empty slot table -> no calls -> loop 16x -> rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0201] = 0x00;             // bpl taken
  m.ram[0x0106] = 0x80;             // bmi taken
  m.ram[0x0202] = 0x20;             // != $10 -> bne taken (skip $ccee); ends < $f0
  // all of $0104/$0105/$0107/$5c/$5f/$9f/$0200/$03ac.. default 0
  loc_97f8(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x0104], 0x20, "speed lo = clamp(0)+$20");
  assert.equal(m.ram[0x0105], 0x00);
  assert.equal(m.ram[0x0107], 0x00);
  assert.equal(m.ram[0x0202], 0x20, "position unchanged (+0)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 339);
});

// $0202 == $10 -> bne not taken -> jsr $ccee seeds sound; otherwise same clean loop
test("$0202 == $10 -> jsr $ccee (pushes $980d)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0201] = 0x00; m.ram[0x0106] = 0x80;
  m.ram[0x0202] = 0x10;             // == $10 -> bne not taken -> jsr $ccee
  loc_97f8(m);
  assert.deepEqual(m.calls, [0xccee]);
  assert.equal(m.retAddrs[0], 0x980d, "jsr $ccee pushes addr+2 (0x980b+2)");
  assert.equal(m.ram[0x0202], 0x10, "position unchanged (+0)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 344);
});

// position overflow: $0202 + $0105 carries -> bcs $9821 taken -> bcc not taken -> clamp path (jsr $ccf2,
// park $0202=$ff); then $0202 >= $50 with $0115==0 -> jsr $a7bd; exits via bcs $987d ($0202 >= $f0)
test("position overflow -> clamp ($ccf2) + reset ($a7bd) -> bcs $987d rts", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0201] = 0x00; m.ram[0x0106] = 0x80;
  m.ram[0x0202] = 0x20;             // != $10
  m.ram[0x0105] = 0xf0;             // $20 + $f0 = $110 -> carry -> clamp path
  m.ram[0x0115] = 0x00;             // -> bne $983d not taken -> jsr $a7bd
  loc_97f8(m);
  assert.deepEqual(m.calls, [0xccf2, 0xa7bd]);
  assert.equal(m.retAddrs[0], 0x982d, "jsr $ccf2 pushes addr+2 (0x982b+2)");
  assert.equal(m.retAddrs[1], 0x9841, "jsr $a7bd pushes addr+2 (0x983f+2)");
  assert.equal(m.ram[0x00], 0x0e, "$00 := $0e before $ccf2");
  assert.equal(m.ram[0x0202], 0xff, "position parked at $ff on overflow");
  assert.equal(m.ram[0x0104], 0x20, "speed lo recomputed");
  assert.equal(m.ram[0x0105], 0xf0, "speed hi = $f0 + carry(0)");
  assert.equal(m.ram[0x5f], 0xf0, "$5f := $5f-accumulator");
  assert.equal(m.ram[0x0114], 0x01, "$0114 bumped ($5f changed)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 178);
});

// slot scan hit: $03ac+x != 0, x == $0200, value < $0202 -> jsr $cd06/$a347/$928f, clear $0115
test("slot scan match at x=5 -> jsr $cd06/$a347/$928f", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0201] = 0x00; m.ram[0x0106] = 0x80;
  m.ram[0x0202] = 0x20;             // stays $20 (< $f0) -> enter loop
  m.ram[0x0200] = 0x05;             // match slot index
  m.ram[0x03b1] = 0x01;             // $03ac+5; non-zero and < $0202($20) -> hit
  m.ram[0x0115] = 0x01;             // will be cleared to 0 on hit
  loc_97f8(m);
  assert.deepEqual(m.calls, [0xcd06, 0xa347, 0x928f]);
  assert.equal(m.retAddrs[0], 0x9892, "jsr $cd06 pushes 0x9890+2");
  assert.equal(m.retAddrs[1], 0x9895, "jsr $a347 pushes 0x9893+2");
  assert.equal(m.retAddrs[2], 0x989d, "jsr $928f pushes 0x989b+2");
  assert.equal(m.ram[0x0115], 0x00, "$0115 cleared on hit");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 374);
});

// abs,x load at $03ac,x cannot cross a page: ldx #$0f bounds x to $0f..0, so $03ac+x <= $03bb stays in
// page $03. Equal to test-3's total confirms every one of the 16 loads is a flat 4 cyc (no +1 crossing).
test("edge: $03ac,x load never page-crosses (x<=$0f) -> flat 4 cyc", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0201] = 0x00; m.ram[0x0106] = 0x80; m.ram[0x0202] = 0x20;
  loc_97f8(m);
  assert.equal(m.cycles, 339, "no crossing surcharge on any loop load");
});
