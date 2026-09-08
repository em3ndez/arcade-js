// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_252a (ROM 0x252a-0x2560). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_252a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_252a } from "../loc_252a.js";

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
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); return undefined; },
  };
}

test("loc_252a: seeds the $EF-$F8 block + $1C07/$2400, clears $BD/$BF; 74 T; RTS", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1fff); // RTS -> pulled + 1 = 0x2000

  loc_252a(m);

  assert.equal(m.ram[0x00f0], 0xf8, "$f0 = 0xf8");
  assert.equal(m.ram[0x00f3], 0xff, "$f3 = 0xff");
  assert.equal(m.ram[0x00f4], 0xfe, "$f4 = 0xfe");
  assert.equal(m.ram[0x00f8], 0xfc, "$f8 = 0xfc");
  assert.equal(m.ram[0x00f1], 0xe0, "$f1 = 0xe0");
  assert.equal(m.ram[0x00ef], 0xc0, "$ef = 0xc0");
  assert.equal(m.ram[0x00f2], 0x40, "$f2 = 0x40");
  assert.equal(m.ram[0x00f5], 0xbf, "$f5 = 0xbf");
  assert.equal(m.ram[0x00f7], 0x03, "$f7 = 0x03");
  assert.equal(m.ram[0x00f6], 0x3f, "$f6 = 0x3f");
  assert.equal(m.ram[0x1c07], 0x80, "$1c07 = 0x80");
  assert.equal(m.ram[0x2400], 0x80, "$2400 = 0x80");
  assert.equal(m.ram[0x00bd], 0x00, "$bd cleared");
  assert.equal(m.ram[0x00bf], 0x00, "$bf cleared");
  assert.equal(m.regs.a, 0x00, "A = last LDA #$00");
  assert.equal(m.regs.fZ, true, "Z from A = 0x00");
  assert.equal(m.regs.fN, false, "N clear");
  assert.equal(m.cycles, 74, "74 T");
  assert.equal(m.pc, 0x2000, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_252a MUTATION: a STA $2400 mischarged 5T not 4T blows the golden T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1fff);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x255a ? 5 : c); // STA $2400 steps to 0x255a
  loc_252a(m);
  assert.notEqual(m.cycles, 74, "a mischarged cycle blows the golden T-state total");
});
