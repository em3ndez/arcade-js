// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_c43c (ROM 0xc43c-0xc452) -- gathers $036a/$035a/$038a/$037a,x into $61-$64,
// then rts. Author-derived 6502 harness.
// Run: node --test games/tempest/translated/test/equivalence-c43c.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_c43c } from "../loc_c43c.js";

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

test("loc_c43c: copies the four indexed cells into $61-$64, returns to pushed+1, 37 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0xc700); // rts -> pulled + 1 = 0xc701
  m._retPushed = false; // this push16 is the caller's return, not a jsr to unwind
  m.ram[0x37] = 0x03;
  m.ram[0x036a + 3] = 0xaa;
  m.ram[0x035a + 3] = 0xbb;
  m.ram[0x038a + 3] = 0xcc;
  m.ram[0x037a + 3] = 0xdd;

  loc_c43c(m);

  assert.equal(m.ram[0x61], 0xaa, "$61 <- $036a,x");
  assert.equal(m.ram[0x62], 0xbb, "$62 <- $035a,x");
  assert.equal(m.ram[0x63], 0xcc, "$63 <- $038a,x");
  assert.equal(m.ram[0x64], 0xdd, "$64 <- $037a,x");
  assert.equal(m.pc, 0xc701, "rts -> pushed + 1");
  assert.equal(m.cycles, 3 + 4 + 3 + 4 + 3 + 4 + 3 + 4 + 3 + 6, "37 T");
});
