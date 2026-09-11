// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a7bd (ROM 0xa7bd-0xa7d1) -- leaf: zeroes $03fe..$0405, overwrites $0405
// with $f0, sets $0115 = $ff. Loop runs x=7..0 (8 stores).
// Run: node --test games/tempest/translated/test/equivalence-a7bd.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a7bd } from "../loc_a7bd.js";

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

// full run: 8-byte clear loop then the two trailing stores
test("clears $03fe..$0405, sets $0405=$f0 and $0115=$ff", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  for (let a = 0x03fe; a <= 0x0405; a++) m.ram[a] = 0xaa; // seed nonzero to prove clearing
  m.ram[0x0115] = 0x11;
  loc_a7bd(m);
  assert.deepEqual(m.calls, [], "leaf routine, no jsr");
  for (let a = 0x03fe; a <= 0x0404; a++) assert.equal(m.ram[a], 0x00, `$${a.toString(16)} cleared`);
  assert.equal(m.ram[0x0405], 0xf0, "$0405 overwritten with $f0");
  assert.equal(m.ram[0x0115], 0xff, "$0115 flag set");
  assert.equal(m.regs.x, 0xff, "x wrapped to 0xff exiting the loop");
  assert.equal(m.pc, 0x5001, "final rts -> pushed return + 1");
  assert.equal(m.cycles, 101);
});
