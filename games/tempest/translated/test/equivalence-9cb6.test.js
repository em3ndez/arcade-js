// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9cb6 (ROM 0x9cb6-0x9d04) -- per-slot(x) steering step on $028a,x bit7.
// bit7 clear -> jsr $9c63; bit7 set -> jsr $9c99 (+ maybe flip bit7); common tail may jsr $a347.
// Run: node --test games/tempest/translated/test/equivalence-9cb6.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9cb6 } from "../loc_9cb6.js";

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

// bit7 clear, coord < threshold -> bcc 9cc7 (skip ldy #0), jsr $9c63; tail bmi 9d04 taken -> epilogue
test("bit7 clear path -> bcc taken -> jsr $9c63, then $0148 bit7 set -> epilogue", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x00;          // bit7 clear -> bmi not taken
  m.ram[0x02df] = 0x05; m.ram[0x0157] = 0x10; // 0x05 < 0x10 -> carry clear -> bcc 9cc7 taken
  m.ram[0x0148] = 0x80;          // bit7 set -> bmi 9d04 taken
  loc_9cb6(m);
  assert.deepEqual(m.calls, [0x9c63]);
  assert.equal(m.retAddrs[0], 0x9cc9, "jsr $9c63 pushes 0x9cc7+2");
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 44);
});

// bit7 clear, coord >= threshold -> bcc not taken -> ldy #0, jsr $9c63; tail bmi set -> epilogue
test("bit7 clear path -> bcc not taken (ldy #0), jsr $9c63", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x00;
  m.ram[0x02df] = 0x50; m.ram[0x0157] = 0x00; // 0x50 >= 0 -> carry set -> bcc not taken -> ldy #0
  m.ram[0x0148] = 0x80;          // tail bmi taken -> epilogue
  loc_9cb6(m);
  assert.deepEqual(m.calls, [0x9c63]);
  assert.equal(m.retAddrs[0], 0x9cc9);
  assert.equal(m.regs.y, 0x00, "ldy #0 executed");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 45);
});

// bit7 set path: jsr $9c99; $03ab==0 -> lda #ff; cmp $0157 carry set -> bcc not taken -> eor #$80 flip
test("bit7 set path -> jsr $9c99, $03ab==0 -> lda #ff, flip bit7 of $028a,x", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x80;          // bit7 set -> bmi 9ccd taken
  m.ram[0x03ab] = 0x00;          // bne not taken -> lda #ff (A = 0xff)
  m.ram[0x0157] = 0x40;          // 0xff >= 0x40 -> carry set -> bcc not taken -> eor path
  m.ram[0x0148] = 0x80;          // tail bmi taken -> epilogue
  loc_9cb6(m);
  assert.deepEqual(m.calls, [0x9c99]);
  assert.equal(m.retAddrs[0], 0x9ccf, "jsr $9c99 pushes 0x9ccd+2");
  assert.equal(m.ram[0x028a], 0x00, "0x80 eor 0x80 -> 0x00 (bit7 flipped)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 54);
});

// bit7 set path: mock $9c99 returns small A, $03ab != 0 -> bne skips lda #ff; cmp carry clear -> bcc 9ce4
test("bit7 set path -> $03ab!=0 (bne taken), A < $0157 -> bcc 9ce4 (skip flip)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x80;
  m.ram[0x03ab] = 0x01;          // bne 9cd7 taken (skip lda #ff)
  m.ram[0x0157] = 0x10;
  m.ram[0x0148] = 0x80;          // tail bmi taken -> epilogue
  const orig = m.call.bind(m);
  m.call = (a) => { orig(a); if (a === 0x9c99) m.regs.a = 0x00; }; // $9c99 leaves A = 0 (< 0x10)
  loc_9cb6(m);
  assert.deepEqual(m.calls, [0x9c99]);
  assert.equal(m.ram[0x028a], 0x80, "no flip (bcc 9ce4 taken)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 43);
});

// full tail: $0148 bit7 clear, coord < thr, $0200==$02b9,x, $0201==$02cc,x -> jsr $a347
test("common tail all-match -> jsr $a347", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x028a] = 0x00;          // bit7 clear path
  m.ram[0x02df] = 0x05; m.ram[0x0157] = 0x10; // bcc 9cc7 taken; tail bcs not taken
  m.ram[0x0148] = 0x00;          // bmi not taken
  m.ram[0x0200] = 0x22; m.ram[0x02b9] = 0x22; // equal -> bne not taken
  m.ram[0x0201] = 0x33; m.ram[0x02cc] = 0x33; // equal -> bne not taken
  loc_9cb6(m);
  assert.deepEqual(m.calls, [0x9c63, 0xa347]);
  assert.equal(m.retAddrs[0], 0x9cc9, "jsr $9c63 ret");
  assert.equal(m.retAddrs[1], 0x9d03, "jsr $a347 pushes 0x9d01+2");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 78);
});

// page-cross edge: x=0x80 pushes each abs,x load into page 0x03 (+1 each); all-match tail -> jsr $a347
test("edge: abs,x page cross adds +1 per crossing load (all-match tail)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;               // 0x028a+0x80=0x030a etc -> every abs,x load crosses into page 0x03
  m.ram[0x030a] = 0x00;          // $028a,x bit7 clear
  m.ram[0x035f] = 0x05;          // $02df,x
  m.ram[0x0157] = 0x10;
  m.ram[0x0148] = 0x00;          // bmi not taken
  m.ram[0x0200] = 0x22; m.ram[0x0339] = 0x22; // $02b9,x -> equal
  m.ram[0x0201] = 0x33; m.ram[0x034c] = 0x33; // $02cc,x -> equal
  loc_9cb6(m);
  assert.deepEqual(m.calls, [0x9c63, 0xa347]);
  assert.equal(m.retAddrs[1], 0x9d03);
  assert.equal(m.cycles, 83, "78 + 5 crossing abs,x loads");
});
