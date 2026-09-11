// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9729 (ROM 0x9729-0x9748) -- masks bit7 of $0123, runs the updater chain
// ($9749,$97f8,$a416,$a23f,$a18f), then conditionally jsr $a504 when $0201 is negative.
// Run: node --test games/tempest/translated/test/equivalence-9729.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9729 } from "../loc_9729.js";

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

// $0201 positive -> bpl 0x9748 taken -> skip $a504
test("$0201 positive -> bpl taken -> skip $a504", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0123] = 0xff;            // and #$7f -> 0x7f stored
  m.ram[0x0201] = 0x00;            // positive -> bpl taken
  loc_9729(m);
  assert.deepEqual(m.calls, [0x9749, 0x97f8, 0xa416, 0xa23f, 0xa18f]);
  assert.deepEqual(m.retAddrs, [0x9733, 0x9736, 0x9739, 0x973c, 0x973f], "each jsr pushed jsraddr+2");
  assert.equal(m.ram[0x0123], 0x7f, "$0123 bit7 cleared");
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 53);
});

// $0201 negative -> bpl not taken -> jsr $a504
test("$0201 negative -> bpl not taken -> jsr $a504", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0123] = 0x00;
  m.ram[0x0201] = 0x80;            // negative -> bpl not taken
  loc_9729(m);
  assert.deepEqual(m.calls, [0x9749, 0x97f8, 0xa416, 0xa23f, 0xa18f, 0xa504]);
  assert.deepEqual(m.retAddrs, [0x9733, 0x9736, 0x9739, 0x973c, 0x973f, 0x9747]);
  assert.equal(m.ram[0x0123], 0x00);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 58);
});
