// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_3a08 (ROM 0x3a08-0x3a1d). Minimal 6502 harness (Regs + flat RAM + the
// page-1 stack seam), author-derived; the whole-machine boot-first state diff vs MAME is the integration
// check. Run: node --test games/centiped/translated/test/loc_3a08.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_3a08 } from "../loc_3a08.js";

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

test("loc_3a08: XOR-fold 61 zero cells (seed 0xff), store to 0x01b5, return old^new; 572 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS -> 0x1234
  for (let a = 0x0178; a <= 0x01b4; a++) m.ram[a] = 0x00; // 61 cells, XOR-fold = 0
  m.ram[0x01b5] = 0x5a; // prior value read by LDY before STA overwrites it

  loc_3a08(m);

  assert.equal(m.ram[0x01b5], 0xff, "STA stored the fold (0xff ^ 0 = 0xff)");
  assert.equal(m.regs.y, 0x5a, "Y = old 0x01b5 (LDY before STA)");
  assert.equal(m.regs.a, 0xa5, "A = old(0x5a) ^ new(0xff) = 0xa5");
  assert.equal(m.regs.fN, true, "N from A = 0xa5 (bit7)");
  assert.equal(m.cycles, 4 + 366 + 182 + 20, "572 T (2+2 setup, 61x(4+2) fold, 60x3+2 BPL, 4+4+2+4+6 tail)");
  assert.equal(m.pc, 0x1234, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "leaf: no m.call");
});

test("loc_3a08: a set bit in one cell inverts the fold parity", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  for (let a = 0x0178; a <= 0x01b4; a++) m.ram[a] = 0x00;
  m.ram[0x0190] = 0x01; // one bit set -> fold = 0x01
  m.ram[0x01b5] = 0x00;

  loc_3a08(m);

  assert.equal(m.ram[0x01b5], 0xfe, "fold = 0xff ^ 0x01 = 0xfe");
  assert.equal(m.regs.a, 0xfe, "A = old(0x00) ^ new(0xfe) = 0xfe");
});

test("loc_3a08 MUTATION: the tail EOR mischarged 5T not 4T is caught by the T-state total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  for (let a = 0x0178; a <= 0x01b4; a++) m.ram[a] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3a1c ? 5 : c); // the 0x3a19 EOR $01b5 step lands at 0x3a1c
  loc_3a08(m);
  assert.notEqual(m.cycles, 572, "a mischarged cycle blows the golden T-state total");
});
