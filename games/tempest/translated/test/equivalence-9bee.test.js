// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9bee (ROM 0x9bee-0x9bf9) -- lda $010c; if nonzero bne to rts, else two inc $010b.
// Two paths, both same-page branches; no abs,x/abs,y load so no page-cross term.
// Run: node --test games/tempest/translated/test/equivalence-9bee.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9bee } from "../loc_9bee.js";

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

test("$010c != 0 -> bne taken -> rts, counter untouched", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x010c] = 0x05;
  m.ram[0x010b] = 0x10;
  loc_9bee(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x010b], 0x10, "counter unchanged (branch taken)");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 13);
});

test("$010c == 0 -> bne not taken -> counter += 2", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x010c] = 0x00;
  m.ram[0x010b] = 0x10;
  loc_9bee(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x010b], 0x12, "counter incremented twice");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 24);
});
