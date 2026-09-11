// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b875 (ROM 0xb875-0xb887) -- rotates arrays $22-$24 / $0809-$080b down by one.
// The single 3-iteration run exercises the bpl loop in BOTH directions (taken x=2,1; not-taken x=0).
// Run: node --test games/tempest/translated/test/equivalence-b875.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b875 } from "../loc_b875.js";

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

// rotate {11,22,33} -> $22..$24 = {22,33,11}, $0809..$080b mirror the rotated result
test("3-iter rotation, bpl both directions, balanced pha/pla", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x22] = 0x11; m.ram[0x23] = 0x22; m.ram[0x24] = 0x33;
  loc_b875(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x22], 0x22, "$22 <- old $23");
  assert.equal(m.ram[0x23], 0x33, "$23 <- old $24");
  assert.equal(m.ram[0x24], 0x11, "$24 <- old $22 (Y wrap)");
  assert.equal(m.ram[0x0809], 0x22, "$0809 mirrors $22");
  assert.equal(m.ram[0x080a], 0x33, "$080a mirrors $23");
  assert.equal(m.ram[0x080b], 0x11, "$080b mirrors $24");
  assert.equal(m.regs.y, 0x11, "Y = final wrap value (old $22)");
  assert.equal(m.regs.a, 0x11, "A = last pla");
  assert.equal(m.regs.x, 0xff, "X dex'd past 0");
  assert.equal(m.regs.s, 0xfd, "stack balanced (pha/pla paired)");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  // pre 5 ; iter x=2: 26+3 ; x=1: 26+3 ; x=0: 26+2 ; rts 6
  assert.equal(m.cycles, 97);
});
