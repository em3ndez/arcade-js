// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b622 (ROM 0xb622-0xb62d) -- Y := $02b9,x; A := (($03 & 3) << 1) + $12; jmp $bcfd.
// Run: node --test games/tempest/translated/test/equivalence-b622.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b622 } from "../loc_b622.js";

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

// straight-line path, no page cross -> tail jmp to $bcfd (no return pushed)
test("no cross: A = (($03&3)<<1)+$12, Y = $02b9,x, tail jmp $bcfd", () => {
  const m = makeMachine();
  m.regs.x = 0x00;
  m.ram[0x03] = 0x02;              // &3 = 0x02 -> asl 0x04 -> +0x12 = 0x16
  m.ram[0x02b9] = 0x77;
  loc_b622(m);
  assert.deepEqual(m.calls, [0xbcfd]);
  assert.equal(m.retAddrs, undefined, "jmp pushes no return address");
  assert.equal(m.regs.a, 0x16, "A = (($03&3)<<1)+$12");
  assert.equal(m.regs.y, 0x77, "Y = $02b9,x");
  assert.equal(m.pc, 0xbcfd, "control transferred to $bcfd");
  assert.equal(m.cycles, 18);
});

// page-cross edge: x=0x80 -> $02b9,x = 0x0339 crosses page 0x02->0x03 (+1 on the ldy)
test("edge: ldy $02b9,x page cross adds +1", () => {
  const m = makeMachine();
  m.regs.x = 0x80;                 // 0x02b9 + 0x80 = 0x0339 -> page cross
  m.ram[0x03] = 0x07;              // &3 = 0x03 -> asl 0x06 -> +0x12 = 0x18
  m.ram[0x0339] = 0x11;
  loc_b622(m);
  assert.deepEqual(m.calls, [0xbcfd]);
  assert.equal(m.regs.a, 0x18);
  assert.equal(m.regs.y, 0x11, "Y = $02b9,x at 0x0339");
  assert.equal(m.pc, 0xbcfd);
  assert.equal(m.cycles, 19, "18 + 1 crossing load");
});
