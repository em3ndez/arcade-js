// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_9bdd (ROM 0x9bdd-0x9bed) -- inc $010b, ldy $010b, lda $a0f7,y, tay, lda $0000,y,
// sta $0298,x, rts. Straight-line; the only cycle variance is the $a0f7,y page-cross term.
// Run: node --test games/tempest/translated/test/equivalence-9bdd.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_9bdd } from "../loc_9bdd.js";

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

// no page cross: counter -> 0x01 keeps $a0f7,y in page $a0
test("no cross: bump counter, table -> zp pointer -> store to $0298,x", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x010b] = 0x00;         // inc -> 0x01
  m.ram[0xa0f8] = 0x40;         // $a0f7,y=$a0f8 (no cross) -> A=0x40 -> tay
  m.ram[0x0040] = 0x77;         // $0000,y=$0040 -> A=0x77
  loc_9bdd(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.ram[0x010b], 0x01, "counter incremented");
  assert.equal(m.ram[0x0298], 0x77, "fetched byte stored to $0298,x");
  assert.equal(m.pc, 0x5001);
  assert.equal(m.regs.s, 0xfd);
  assert.equal(m.cycles, 31);
});

// page-cross edge: counter -> 0x09 pushes $a0f7,y to $a100 (+1)
test("edge: $a0f7,y page cross adds +1", () => {
  const m = makeMachine(); m.regs.s = 0xfd; m.push16(0x5000);
  m.regs.x = 0x00;
  m.ram[0x010b] = 0x08;         // inc -> 0x09
  m.ram[0xa100] = 0x50;         // $a0f7+9=$a100 crosses page $a0->$a1
  m.ram[0x0050] = 0x22;
  loc_9bdd(m);
  assert.equal(m.ram[0x0298], 0x22);
  assert.equal(m.cycles, 32, "31 + 1 page cross on $a0f7,y");
});
