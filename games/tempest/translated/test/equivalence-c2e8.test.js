// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c2e8 (ROM 0xc2e8-0xc30c) -- divide-by-0x10 loop counting quotient in X /
// remainder in A, table index $bc7c,y -> $0112, then A=(t<<4)|0x0f. Minimal 6502 harness, author-derived.
// Run: node --test games/tempest/translated/test/equivalence-c2e8.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c2e8 } from "../loc_c2e8.js";

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

test("loc_c2e8: A=0x35 (<0x62), 0x35/0x10 = 3 rem 5; table -> A=(t<<4)|0x0f; 73 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // rts -> 0x2001
  m.regs.a = 0x35;
  m.ram[0xbc81] = 0x0a; // $bc7c + y(=5)
  loc_c2e8(m);
  assert.equal(m.regs.x, 0x03, "quotient 0x35/0x10 = 3");
  assert.equal(m.regs.y, 0x05, "remainder 5 -> Y (tay)");
  assert.equal(m.ram[0x0112], 0x0a, "table value stored at $0112");
  assert.equal(m.regs.a, 0xaf, "(0x0a<<4)|0x0f = 0xaf");
  assert.equal(m.regs.fC, false, "last asl of 0x0a..0xa0 leaves carry clear");
  assert.equal(m.pc, 0x2001, "rts -> pushed+1");
  assert.equal(m.cycles, 73, "golden T-state total for the A=0x35 path");
});

test("loc_c2e8: A=0x70 (>=0x62) masks $60ca&0x5f then divides", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.regs.a = 0x70;
  m.ram[0x60ca] = 0xff; // & 0x5f = 0x5f
  m.ram[0xbc8b] = 0x03; // $bc7c + y(=0x0f)
  loc_c2e8(m);
  assert.equal(m.regs.x, 0x05, "0x5f/0x10 = 5");
  assert.equal(m.regs.y, 0x0f, "0x5f % 0x10 = 0x0f");
  assert.equal(m.ram[0x0112], 0x03, "table value from masked index");
  assert.equal(m.regs.a, 0x3f, "(0x03<<4)|0x0f = 0x3f");
});

test("loc_c2e8: A<0x10 skips the divide loop entirely (X stays 0)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.regs.a = 0x07;
  m.ram[0xbc83] = 0x01; // y = 7
  loc_c2e8(m);
  assert.equal(m.regs.x, 0x00, "no subtraction -> quotient 0");
  assert.equal(m.regs.y, 0x07, "remainder = A");
  assert.equal(m.regs.a, 0x1f, "(0x01<<4)|0x0f = 0x1f");
});
