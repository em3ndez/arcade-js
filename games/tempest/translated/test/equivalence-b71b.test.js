// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b71b (ROM 0xb71b-0xb754) -- table-lookup on ($0148+$40)>>4 (clamped <5, else 0)
// into $9e/$29, then sign-of-$0283,x dispatch: clear -> jsr $bda0; set -> jsr $b634 + jsr $bdcb.
// Run: node --test games/tempest/translated/test/equivalence-b71b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b71b } from "../loc_b71b.js";

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

// $0148 minus -> bmi taken (A stays 4); index 12 >= 5 -> bcc not taken (index 0);
// $0283,x bit7 clear -> bmi $b73f not taken -> ldy $02b9,x, jsr $bda0, clv/bvc join, rts
test("$0148 minus, bcc not taken, $0283,x plus -> jsr $bda0 path", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0148] = 0x80;            // minus -> bmi $b724 taken (A=4); ($80+$40)&ff=$c0 >>4 = 12 >=5 -> bcc NOT taken
  m.ram[0xb755] = 0x29;            // table[0]
  m.ram[0x0283] = 0x00;            // bit7 clear -> bmi $b73f not taken
  m.ram[0x02b9] = 0x66;
  loc_b71b(m);
  assert.deepEqual(m.calls, [0xbda0]);
  assert.equal(m.retAddrs[0], 0xb748, "jsr $bda0 pushes addr+2 (0xb746+2)");
  assert.equal(m.ram[0x9e], 0x04, "$9e latches 4 ($0148 minus)");
  assert.equal(m.ram[0x29], 0x29, "$29 = table[0] at $b755");
  assert.equal(m.regs.y, 0x66, "Y = $02b9,x before jsr $bda0");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 73);
});

// $0148 plus -> bmi not taken (A=0); index 4 < 5 -> bcc taken; $0283,x bit7 set -> jsr $b634 + jsr $bdcb
test("$0148 plus, bcc taken, $0283,x minus -> jsr $b634 + jsr $bdcb path", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x0148] = 0x00;            // plus -> bmi not taken (A=0); ($00+$40)>>4 = 4 < 5 -> bcc taken (index 4)
  m.ram[0xb759] = 0x3c;            // table[4]
  m.ram[0x0283] = 0x80;            // bit7 set -> bmi $b73f taken
  loc_b71b(m);
  assert.deepEqual(m.calls, [0xb634, 0xbdcb]);
  assert.equal(m.retAddrs[0], 0xb74e, "jsr $b634 pushes addr+2 (0xb74c+2)");
  assert.equal(m.retAddrs[1], 0xb753, "jsr $bdcb pushes addr+2 (0xb751+2)");
  assert.equal(m.ram[0x9e], 0x00, "$9e latches 0 ($0148 plus)");
  assert.equal(m.ram[0x29], 0x3c, "$29 = table[4] at $b759");
  assert.equal(m.regs.y, 0x3c, "Y reloaded from $29 before jsr $bdcb");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 71);
});

// page-cross edge: x=0x80 -> $0283,x=0x0303 and $02b9,x=0x0339 both cross page (+1 each), $bda0 path
test("edge: abs,x page cross adds +1 per crossing load ($0283,x + $02b9,x)", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x80;                 // 0x0283+0x80=0x0303, 0x02b9+0x80=0x0339 -> both cross into page 0x03
  m.ram[0x0148] = 0x80;            // minus -> bcc not taken (index 0)
  m.ram[0xb755] = 0x29;
  m.ram[0x0303] = 0x00;            // $0283,x bit7 clear -> bmi $b73f not taken
  m.ram[0x0339] = 0x66;            // $02b9,x
  loc_b71b(m);
  assert.deepEqual(m.calls, [0xbda0]);
  assert.equal(m.retAddrs[0], 0xb748);
  assert.equal(m.regs.y, 0x66, "Y = $02b9,x at 0x0339");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 75, "73 + 2 crossing loads");
});
