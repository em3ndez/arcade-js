// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9bfa (ROM 0x9bfa-0x9c0b) -- inc $010b; if gate $010c != 0 bne to rts, else reload
// $010b from table $a0f7,y indexed by the bumped counter. Cycle variance is the $a0f7,y page cross.
// Run: node --test games/tempest/translated/test/equivalence-9bfa.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9bfa } from "../loc_9bfa.js";

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

test("gate $010c != 0 -> bne taken -> counter bumped once, no reload", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x010b] = 0x10;
  m.ram[0x010c] = 0x01;
  loc_9bfa(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x010b], 0x11, "counter only incremented");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 19);
});

test("gate == 0, no cross -> reload $010b from table $a0f7,y", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x010b] = 0x00;         // inc -> 0x01
  m.ram[0x010c] = 0x00;
  m.ram[0xa0f8] = 0x42;         // $a0f7,y=$a0f8 (no cross)
  loc_9bfa(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x010b], 0x42, "counter reloaded from table");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.cycles, 30);
});

test("edge: gate == 0, $a0f7,y page cross adds +1", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.ram[0x010b] = 0x08;         // inc -> 0x09 -> $a100 crosses
  m.ram[0x010c] = 0x00;
  m.ram[0xa100] = 0x55;
  loc_9bfa(m);
  assert.equal(m.ram[0x010b], 0x55);
  assert.equal(m.cycles, 31, "30 + 1 page cross");
});
