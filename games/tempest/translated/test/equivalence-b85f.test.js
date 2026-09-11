// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b85f (ROM 0xb85f-0xb874) -- seeds arrays $22-$24 / $0809-$080b to {0,4,0xc}.
// Run: node --test games/tempest/translated/test/equivalence-b85f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b85f } from "../loc_b85f.js";

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

// straight-line: no branches, no calls; every cell gets its immediate; A=0 at rts
test("seeds paired arrays, straight-line", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  // pre-fill with junk so the writes are observable
  m.ram[0x22] = 0xff; m.ram[0x23] = 0xff; m.ram[0x24] = 0xff;
  m.ram[0x0809] = 0xff; m.ram[0x080a] = 0xff; m.ram[0x080b] = 0xff;
  loc_b85f(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x24], 0x0c, "$24 = $0c");
  assert.equal(m.ram[0x080b], 0x0c, "$080b = $0c");
  assert.equal(m.ram[0x23], 0x04, "$23 = $04");
  assert.equal(m.ram[0x080a], 0x04, "$080a = $04");
  assert.equal(m.ram[0x22], 0x00, "$22 = $00");
  assert.equal(m.ram[0x0809], 0x00, "$0809 = $00");
  assert.equal(m.regs.a, 0x00, "A = last immediate $00");
  assert.equal(m.regs.fZ, true, "Z set from lda #$00");
  assert.equal(m.regs.fN, false, "N clear");
  assert.equal(m.pc, 0x5001, "rts -> pushed return + 1");
  assert.equal(m.cycles, 33, "2+4+3+2+4+3+2+3+4+6");
});
