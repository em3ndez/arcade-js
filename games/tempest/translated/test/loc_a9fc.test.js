// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a9fc (ROM 0xa9fc-0xaa12). Minimal 6502 harness (Regs + flat RAM + page-1
// stack seam), author-derived. Maps A's low nibble to a $31e4 word and stores it at $2f60,x (x += 2).
// The php/plp pair is internal and balanced. Run: node --test .../loc_a9fc.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a9fc } from "../loc_a9fc.js";

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

test("loc_a9fc: nibble 5, carry clear -> iny -> index 0x0c; store $31e4,0x0c at $2f60,x; 44 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.regs.a = 0x35; m.regs.x = 0x02;
  m.push16(0x3000);          // rts -> 0x3001
  m.ram[0x31f0] = 0x77;      // $31e4 + 0x0c

  loc_a9fc(m);

  assert.equal(m.regs.y, 0x0c, "Y = (nibble 5 -> +1 -> 6) << 1 = 0x0c");
  assert.equal(m.regs.a, 0x77, "A = $31e4,y");
  assert.equal(m.ram[0x2f62], 0x77, "stored at $2f60,x(2)");
  assert.equal(m.regs.x, 0x04, "X += 2");
  assert.equal(m.pc, 0x3001, "rts -> pushed + 1");
  assert.equal(m.cycles, 44, "2+2+2+2+2+2+3+2+2+2+4+5+2+2+4+6");
});

test("loc_a9fc: nibble 0, carry set -> beq+bcs both taken (no iny) -> index 0; 42 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd; m.regs.a = 0x30; m.regs.x = 0x10; m.regs.fC = true;
  m.push16(0x4000);
  m.ram[0x31e4] = 0x99;      // index 0

  loc_a9fc(m);

  assert.equal(m.regs.y, 0x00, "Y = (nibble 0, no iny) << 1 = 0");
  assert.equal(m.regs.a, 0x99, "A = $31e4,0");
  assert.equal(m.ram[0x2f70], 0x99, "stored at $2f60,x(0x10)");
  assert.equal(m.regs.x, 0x12, "X += 2");
  assert.equal(m.pc, 0x4001, "rts -> pushed + 1");
  assert.equal(m.cycles, 42, "beq taken 3 + bcs taken 3 replace the fall+clc+fall+iny path");
});
