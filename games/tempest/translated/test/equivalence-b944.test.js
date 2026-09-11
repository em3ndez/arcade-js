// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b944 (ROM 0xb944-0xb954) -- swaps 16-bit pointer $74/$75 with $76/$77.
// Minimal 6502 harness (Regs + flat RAM + page-1 stack seam), author-derived. Run:
//   node --test games/tempest/translated/test/equivalence-b944.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b944 } from "../loc_b944.js";

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

test("loc_b944: swaps $74/$75 <-> $76/$77, X=old lo, Y=old hi, A=old $77, 30 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  m.ram[0x74] = 0x11; m.ram[0x75] = 0x22; m.ram[0x76] = 0x33; m.ram[0x77] = 0x44;

  loc_b944(m);

  assert.equal(m.ram[0x74], 0x33, "$74 <- old $76");
  assert.equal(m.ram[0x75], 0x44, "$75 <- old $77");
  assert.equal(m.ram[0x76], 0x11, "$76 <- old $74");
  assert.equal(m.ram[0x77], 0x22, "$77 <- old $75");
  assert.equal(m.regs.x, 0x11, "X holds old $74");
  assert.equal(m.regs.y, 0x22, "Y holds old $75");
  assert.equal(m.regs.a, 0x44, "A last loaded from old $77");
  assert.equal(m.regs.fN, false, "0x44 -> N clear");
  assert.equal(m.pc, 0x1234, "RTS -> pushed + 1");
  assert.equal(m.cycles, 8 * 3 + 6, "8 zp ops (3T) + rts (6T) = 30 T");
});

test("loc_b944: high-bit values set N on the last load", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x74] = 0x00; m.ram[0x75] = 0x00; m.ram[0x76] = 0x00; m.ram[0x77] = 0x80;

  loc_b944(m);

  assert.equal(m.ram[0x75], 0x80, "$75 <- old $77 = 0x80");
  assert.equal(m.regs.a, 0x80, "A = old $77 = 0x80");
  assert.equal(m.regs.fN, true, "0x80 -> N set");
});
