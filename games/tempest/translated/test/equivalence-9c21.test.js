// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9c21 (ROM 0x9c21-0x9c3a) -- ldy $02b9,x; lda $03ac,y (default $ff when 0);
// cmp $02df,x; stores 1 to $010c when the looked-up value >= $02df,x (carry), else 0.
// Run: node --test games/tempest/translated/test/equivalence-9c21.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9c21 } from "../loc_9c21.js";

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

test("entry != 0 (bne taken), value >= $02df,x (bcs taken) -> $010c = 1", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02b9] = 0x00;   // y = 0
  m.ram[0x03ac] = 0x50;   // entry nonzero -> bne taken, A = 0x50
  m.ram[0x02df] = 0x10;   // 0x50 >= 0x10 -> carry -> bcs taken
  loc_9c21(m);
  assert.equal(m.ram[0x010c], 0x01, "flag = 1");
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 30);
});

test("entry != 0 (bne taken), value < $02df,x (bcs not taken) -> $010c = 0 (clv;bvc join)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02b9] = 0x00;
  m.ram[0x03ac] = 0x10;   // A = 0x10
  m.ram[0x02df] = 0x50;   // 0x10 >= 0x50 false -> carry clear -> bcs not taken
  loc_9c21(m);
  assert.equal(m.ram[0x010c], 0x00, "flag = 0");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 34);
});

test("entry == 0 (bne not taken) -> lda #$ff; $ff >= $02df,x always -> $010c = 1", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x02b9] = 0x00;
  m.ram[0x03ac] = 0x00;   // entry 0 -> bne NOT taken -> A = 0xff
  m.ram[0x02df] = 0x10;   // 0xff >= 0x10 -> bcs taken
  loc_9c21(m);
  assert.equal(m.ram[0x010c], 0x01, "flag = 1 via #$ff default");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 31);
});

test("edge: abs,x / abs,y page cross (x=0x80) adds +1 per crossing load", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;        // $02b9+0x80=0x0339 (cross), $02df+0x80=0x035f (cross)
  m.ram[0x0339] = 0x60;   // y = 0x60 -> $03ac+0x60=0x040c (cross)
  m.ram[0x040c] = 0x50;   // A = 0x50, nonzero -> bne taken
  m.ram[0x035f] = 0x10;   // 0x50 >= 0x10 -> bcs taken
  loc_9c21(m);
  assert.equal(m.ram[0x010c], 0x01);
  assert.equal(m.cycles, 33, "base 30 + 3 crossing loads");
});
