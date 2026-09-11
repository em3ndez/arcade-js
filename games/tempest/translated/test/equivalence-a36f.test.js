// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a36f (ROM 0xa36f-0xa38d). Minimal 6502 harness. Run:
// node --test games/tempest/translated/test/equivalence-a36f.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a36f } from "../loc_a36f.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_a36f: copies $02db,y/$02b5,y, clears $02db,y, dec $a6, flags $02f2,x, 53 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1700);
  m.regs.y = 0x03; m.regs.x = 0x01;
  m.ram[0x02de] = 0x55; // $02db + 3
  m.ram[0x02b8] = 0x66; // $02b5 + 3
  m.ram[0xa6] = 0x05;
  loc_a36f(m);
  assert.equal(m.ram[0x29], 0x55, "$02db,y -> $29");
  assert.equal(m.ram[0x2d], 0x66, "$02b5,y -> $2d");
  assert.equal(m.ram[0x02de], 0x00, "$02db,y cleared");
  assert.equal(m.ram[0xa6], 0x04, "$a6 decremented");
  assert.equal(m.ram[0x02f3], 0xff, "$02f2,x (x=1) = 0xff");
  assert.deepEqual(m.calls, [0xccc1, 0xa3d4], "jsr ccc1 then a3d4");
  assert.equal(m.pc, 0x1701, "rts -> pushed + 1");
  assert.equal(m.cycles, 53, "linear T-state total");
});

test("loc_a36f: dec $a6 wraps 0x00 -> 0xff (N set)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1700);
  m.regs.y = 0x00; m.regs.x = 0x00;
  m.ram[0xa6] = 0x00;
  loc_a36f(m);
  assert.equal(m.ram[0xa6], 0xff, "0x00 - 1 = 0xff");
  assert.equal(m.regs.fN, true, "dec result 0xff -> N set");
});
