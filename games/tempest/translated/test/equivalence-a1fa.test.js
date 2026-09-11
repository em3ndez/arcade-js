// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a1fa (ROM 0xa1fa-0xa23e). Minimal 6502 harness; JSR $ccf6/$ca6c opaque
// (recorded). Run: node --test games/tempest/translated/test/equivalence-a1fa.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a1fa } from "../loc_a1fa.js";

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

test("loc_a1fa: limit ($03ac,y) zero -> BEQ to rts; 17 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x1000);
  m.regs.x = 0x00;
  m.ram[0x02ad] = 0x03; // Y
  m.ram[0x03ac + 0x03] = 0x00; // limit 0 -> BEQ taken
  loc_a1fa(m);
  assert.deepEqual(m.calls, [], "no jsr");
  assert.equal(m.pc, 0x1001, "rts -> pushed+1");
  assert.equal(m.cycles, 4 + 4 + 3 + 6, "17 T");
});

test("loc_a1fa: over-limit but <0xf0 -> clamp, inc $02f2,x, jsr ccf6+ca6c, count<2 -> rts; 89 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x2000);
  m.regs.x = 0x00;
  m.ram[0x02ad] = 0x02;       // Y = 2
  m.ram[0x03ac + 0x02] = 0x50; // limit = 0x50 (nonzero)
  m.ram[0x02d3] = 0x60;        // $02d3,x = 0x60 >= 0x50 (bcc a22f not taken), < 0xf0 (bcc a210 taken)
  m.ram[0x02f2] = 0x00;        // count -> inc to 1
  m.ram[0x37] = 0x00;          // ldx 0x37 reload -> X=0
  loc_a1fa(m);
  assert.equal(m.ram[0x03ac + 0x02], 0x60, "$03ac,y written with A (0x60, no clear since <0xf0)");
  assert.equal(m.ram[0x02f2], 0x01, "$02f2,x incremented");
  assert.equal(m.ram[0x039a + 0x02], 0xc0, "$039a,y = 0xc0");
  assert.equal(m.ram[0x2a], 0x00, "$2a = 0");
  assert.equal(m.ram[0x2b], 0x00, "$2b = 0");
  assert.equal(m.ram[0x29], 0x01, "$29 = 1");
  assert.deepEqual(m.calls, [0xccf6, 0xca6c], "jsr ccf6 then ca6c");
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.equal(m.cycles, 89, "traced total");
});

test("loc_a1fa: under-limit -> BCC a22f, count>=2 -> clear $02d3,x + dec $0135; 48 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.push16(0x3000);
  m.regs.x = 0x00;
  m.ram[0x02ad] = 0x01;        // Y = 1
  m.ram[0x03ac + 0x01] = 0x80;  // limit nonzero
  m.ram[0x02d3] = 0x10;        // < 0x80 -> bcc a22f taken
  m.ram[0x02f2] = 0x02;        // count >= 2 -> bcc a23e not taken
  m.ram[0x0135] = 0x05;
  loc_a1fa(m);
  assert.equal(m.ram[0x02d3], 0x00, "$02d3,x cleared");
  assert.equal(m.ram[0x0135], 0x04, "$0135 decremented");
  assert.deepEqual(m.calls, [], "no jsr on the under-limit path");
  assert.equal(m.pc, 0x3001, "rts -> pushed+1");
  assert.equal(m.cycles, 48, "traced total");
});
