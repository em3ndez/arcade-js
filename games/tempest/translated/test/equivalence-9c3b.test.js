// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9c3b (ROM 0x9c3b-0x9c4e) -- straight line:
// $010c = ((((($0147 << 2) + $0148) & $0148) & $80) ^ $80). No branches, always 32 cycles.
// Run: node --test games/tempest/translated/test/equivalence-9c3b.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9c3b } from "../loc_9c3b.js";

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

// A=0x21: asl->0x42->0x84; +0x55=0xd9; &0x55=0x51; &0x80=0x00; ^0x80=0x80
test("high bit clear in product -> $010c = 0x80", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0147] = 0x21;
  m.ram[0x0148] = 0x55;
  loc_9c3b(m);
  assert.equal(m.ram[0x010c], 0x80);
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 32);
});

// A=0x40: asl->0x80->0x00; clc; +0x80=0x80; &0x80=0x80; &0x80=0x80; ^0x80=0x00
test("high bit set in product -> $010c = 0x00", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x0147] = 0x40;
  m.ram[0x0148] = 0x80;
  loc_9c3b(m);
  assert.equal(m.ram[0x010c], 0x00);
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 32);
});
